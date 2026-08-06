/**
 * realtime-coordinator.js
 *
 * The Durable Object pattern behind a live shared tally: several people scanning the same
 * physical items on different devices, each needing to see the others' scans immediately.
 *
 * Why a Durable Object rather than a database and polling. A shared tally needs a single
 * authoritative sequence of events and a push channel. Interval sync cannot provide either:
 * with a sync every N seconds, a scan on device A reaches device B only after A uploads and
 * B downloads, so the window where two people can double-count is structural rather than a
 * tuning problem. A Durable Object gives one single-threaded actor per session, colocated
 * storage, and sockets that stay open, which removes the window entirely.
 *
 * Sanitized: synthetic ids, no client data, no business logic. This is the shape, not the
 * system.
 *
 * WHAT THIS DEMONSTRATES
 *   - one DO instance per (location, date), so contention is bounded and old sessions
 *     fall out of memory on their own
 *   - WebSocket Hibernation, so idle connections are evicted from memory and cost nothing
 *     while a depot sits quiet between arrivals
 *   - colocated SQLite as the source of truth, not in-memory state, so a hibernated or
 *     evicted object wakes up correct
 *   - idempotent scan handling: the same scan replayed from an offline queue is a no-op,
 *     which is what makes the client's retry loop safe
 *   - a monotonic sequence and a replay endpoint, so a client that missed messages catches
 *     up on the delta instead of refetching everything
 *
 * WORKER BINDING (wrangler.jsonc)
 *   {
 *     "durable_objects": {
 *       "bindings": [{ "name": "TALLY", "class_name": "TallyRoom" }]
 *     },
 *     "migrations": [
 *       { "tag": "v1", "new_sqlite_classes": ["TallyRoom"] }
 *     ]
 *   }
 *
 * `new_sqlite_classes` (not `new_classes`) is required for the SQLite storage backend.
 * A class that ships on the key-value backend cannot be migrated to SQLite later, so this
 * is a decision you make once, at creation.
 */

/* ------------------------------------------------------------------ *
 * Worker: routes a request to the one object that owns this session.
 * ------------------------------------------------------------------ */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // The session key IS the routing key. One object per location per day means a busy
    // depot never shares an actor with another depot, and yesterday's object is simply
    // never addressed again rather than needing a cleanup job.
    const locationId = url.searchParams.get('location');
    const date = url.searchParams.get('date');

    if (!locationId || !/^[A-Za-z0-9_-]{1,64}$/.test(locationId)) {
      return json({ error: 'bad_location' }, 400);
    }
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return json({ error: 'bad_date' }, 400);
    }

    const id = env.TALLY.idFromName(`${locationId}:${date}`);
    return env.TALLY.get(id).fetch(request);
  },
};

/* ------------------------------------------------------------------ *
 * The Durable Object.
 * ------------------------------------------------------------------ */

export class TallyRoom {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = env;
    this.sql = ctx.storage.sql;

    // blockConcurrencyWhile defers every incoming request until the schema exists, so no
    // request can observe a half-initialized object. It runs once per wake, and a wake is
    // cheap because the statements are idempotent.
    ctx.blockConcurrencyWhile(async () => {
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS scans (
          seq         INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id     TEXT    NOT NULL,
          side        TEXT    NOT NULL,
          device_id   TEXT    NOT NULL,
          scanned_at  INTEGER NOT NULL,
          UNIQUE (item_id, side)
        );
      `);
      // The manifest is what SHOULD arrive. Without it a tally can only count what it has
      // seen, which cannot tell you the one thing that matters: what is missing.
      this.sql.exec(`
        CREATE TABLE IF NOT EXISTS manifest (
          item_id TEXT PRIMARY KEY
        );
      `);
    });
  }

  async fetch(request) {
    const url = new URL(request.url);

    if (request.headers.get('Upgrade') === 'websocket') {
      return this.#openSocket(request);
    }

    switch (url.pathname) {
      case '/manifest':
        return this.#loadManifest(request);
      case '/scan':
        return this.#httpScan(request);
      case '/state':
        return json(this.#snapshot());
      case '/replay':
        return json({ events: this.#since(Number(url.searchParams.get('since') || 0)) });
      default:
        return json({ error: 'not_found' }, 404);
    }
  }

  /* -------------------- sockets -------------------- */

  #openSocket(request) {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // acceptWebSocket, NOT server.accept(). This is the hibernation API: the runtime may
    // evict this object from memory while the socket stays open, then re-create it and
    // call webSocketMessage() when a frame arrives. With server.accept() the object would
    // be pinned in memory for as long as anyone was connected, which for a depot that is
    // idle most of the day is most of the cost for none of the benefit.
    this.ctx.acceptWebSocket(server);

    // Anything the handler needs after a hibernation round trip has to be ON the socket.
    // Instance fields do not survive eviction; the attachment does.
    const deviceId = new URL(request.url).searchParams.get('device') || 'unknown';
    server.serializeAttachment({ deviceId });

    server.send(JSON.stringify({ type: 'snapshot', ...this.#snapshot() }));
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws, raw) {
    let msg;
    try {
      msg = JSON.parse(raw);
    } catch {
      return ws.send(JSON.stringify({ type: 'error', error: 'bad_json' }));
    }

    const { deviceId } = ws.deserializeAttachment() || { deviceId: 'unknown' };

    if (msg.type === 'scan') {
      const result = this.#applyScan(msg.itemId, msg.side, deviceId);

      // Always answer the sender, including on a duplicate. The client's offline queue
      // retries until it is acknowledged, so an unacknowledged duplicate would retry for
      // ever.
      ws.send(JSON.stringify({ type: 'scan_ack', itemId: msg.itemId, ...result }));

      // Only tell everyone else when something actually changed.
      if (result.applied) this.#broadcast({ type: 'scan', ...result.event }, ws);
      return;
    }

    if (msg.type === 'resume') {
      // A client that dropped and reconnected sends its last sequence number and gets the
      // delta. Cheaper than a full snapshot and it cannot miss an event in the gap.
      ws.send(JSON.stringify({ type: 'replay', events: this.#since(Number(msg.since) || 0) }));
      return;
    }

    ws.send(JSON.stringify({ type: 'error', error: 'unknown_type' }));
  }

  async webSocketClose(ws, code, reason, wasClean) {
    // Nothing to clean up: state lives in SQLite, not in a connection registry. That is
    // the point. An abrupt disconnect cannot corrupt the tally.
  }

  async webSocketError(ws, err) {
    console.error('socket error', err && err.message);
  }

  #broadcast(payload, except) {
    const body = JSON.stringify(payload);
    // getWebSockets() is rebuilt by the runtime after a hibernation wake, so it is correct
    // even though this object may have been re-created a millisecond ago.
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === except) continue;
      try {
        ws.send(body);
      } catch {
        // A socket that has gone away is not an error worth failing a scan over.
      }
    }
  }

  /* -------------------- domain -------------------- */

  /**
   * Record one scan. Idempotent by (item_id, side): replaying the same scan returns
   * applied:false and changes nothing.
   *
   * Idempotency here is not a nicety. The client queues scans while offline and flushes
   * them on reconnect, and a flush that is interrupted mid-way will resend. Without the
   * UNIQUE constraint and this branch, a dropped connection would inflate the count.
   */
  #applyScan(itemId, side, deviceId) {
    if (typeof itemId !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/.test(itemId)) {
      return { applied: false, reason: 'bad_item_id' };
    }
    if (side !== 'outbound' && side !== 'inbound') {
      return { applied: false, reason: 'bad_side' };
    }

    const known = this.sql
      .exec('SELECT 1 FROM manifest WHERE item_id = ?', itemId)
      .toArray().length > 0;

    // An item that is not on the manifest is a real operational event, not a validation
    // failure. It is recorded and flagged, never silently dropped, because "something
    // arrived that we were not expecting" is exactly what the people on the floor need
    // to know about.
    const scannedAt = Date.now();
    const rows = this.sql
      .exec(
        `INSERT INTO scans (item_id, side, device_id, scanned_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT (item_id, side) DO NOTHING
         RETURNING seq`,
        itemId, side, deviceId, scannedAt
      )
      .toArray();

    if (rows.length === 0) {
      return { applied: false, reason: 'duplicate', unexpected: !known };
    }

    return {
      applied: true,
      unexpected: !known,
      event: { seq: rows[0].seq, itemId, side, deviceId, scannedAt, unexpected: !known },
    };
  }

  #snapshot() {
    const expected = this.sql.exec('SELECT COUNT(*) AS n FROM manifest').one().n;
    const counts = this.sql
      .exec('SELECT side, COUNT(*) AS n FROM scans GROUP BY side')
      .toArray();
    const seq = this.sql.exec('SELECT COALESCE(MAX(seq), 0) AS s FROM scans').one().s;

    // The whole reason the tool exists: what is on the manifest and has not been scanned
    // inbound. Computed, never stored, so it cannot drift from the scans it summarizes.
    const outstanding = this.sql
      .exec(
        `SELECT m.item_id
           FROM manifest m
           LEFT JOIN scans s ON s.item_id = m.item_id AND s.side = 'inbound'
          WHERE s.item_id IS NULL
          ORDER BY m.item_id`
      )
      .toArray()
      .map(r => r.item_id);

    const unexpected = this.sql
      .exec(
        `SELECT s.item_id
           FROM scans s
           LEFT JOIN manifest m ON m.item_id = s.item_id
          WHERE m.item_id IS NULL
          GROUP BY s.item_id
          ORDER BY s.item_id`
      )
      .toArray()
      .map(r => r.item_id);

    return {
      seq,
      expected,
      scanned: Object.fromEntries(counts.map(c => [c.side, c.n])),
      outstanding,
      unexpected,
      allIn: outstanding.length === 0 && expected > 0,
    };
  }

  #since(seq) {
    return this.sql
      .exec(
        `SELECT seq, item_id AS itemId, side, device_id AS deviceId, scanned_at AS scannedAt
           FROM scans WHERE seq > ? ORDER BY seq`,
        seq
      )
      .toArray();
  }

  async #loadManifest(request) {
    if (request.method !== 'POST') return json({ error: 'method' }, 405);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad_json' }, 400);
    }
    if (!Array.isArray(body.items)) return json({ error: 'items_required' }, 400);

    // Replacing the manifest must not discard scans already taken against it. A late
    // manifest correction is normal; losing the morning's work to one is not.
    this.sql.exec('DELETE FROM manifest');
    for (const itemId of body.items) {
      if (typeof itemId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(itemId)) {
        this.sql.exec('INSERT OR IGNORE INTO manifest (item_id) VALUES (?)', itemId);
      }
    }

    const snap = this.#snapshot();
    this.#broadcast({ type: 'snapshot', ...snap });
    return json(snap);
  }

  async #httpScan(request) {
    // The same entry point over plain HTTP, for a client whose socket is down. It shares
    // #applyScan with the socket path deliberately: two code paths for one operation is
    // how the two disagree.
    if (request.method !== 'POST') return json({ error: 'method' }, 405);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ error: 'bad_json' }, 400);
    }

    const result = this.#applyScan(body.itemId, body.side, body.deviceId || 'http');
    if (result.applied) this.#broadcast({ type: 'scan', ...result.event });
    return json(result);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
