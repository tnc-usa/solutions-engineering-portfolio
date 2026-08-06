/**
 * d1-etl-upsert.js
 *
 * The scheduled ETL pattern behind an analytical store whose SOURCE deletes its own history.
 *
 * The constraint that shapes this whole design: the upstream system hard-deletes rows on a
 * rolling retention window. There is no backfill. If a run misses a window, that data is
 * gone permanently, so the warehouse is not a performance optimization, it is the only
 * durable copy. Every decision below follows from that.
 *
 * Sanitized: synthetic table and column names, no client data, no business logic.
 *
 * WHAT THIS DEMONSTRATES
 *   - a watermark with deliberate overlap, so a clock skew or a late write cannot open a
 *     permanent hole
 *   - dedupe in JS before the write, because the source can legitimately return the same
 *     natural key twice within one window
 *   - multi-row upserts chunked under D1's bound-parameter ceiling, computed from the column
 *     count rather than hard-coded
 *   - an explicit quarantine table for rows that cannot be resolved, never a guess and never
 *     a silent drop
 *   - a run log written even when the run fails, so a partial failure is visible instead of
 *     looking like a quiet success
 *   - the watermark advancing ONLY on a fully successful run
 *
 * WORKER CONFIG (wrangler.jsonc)
 *   {
 *     "d1_databases": [{ "binding": "DB", "database_name": "warehouse", "database_id": "..." }],
 *     "triggers": { "crons": ["*\/10 * * * *"] }
 *   }
 *
 * Secrets via `wrangler secret put`: SOURCE_URL, SOURCE_TOKEN.
 */

/* D1 caps bound parameters per statement. Deriving the chunk size from the column count
 * means adding a column cannot silently push a statement over the limit: the batch simply
 * gets smaller. A hard-coded "500 rows" is the version of this that breaks in six months. */
const MAX_BOUND_PARAMS = 100;

/* Re-read a window of already-seen time on every run. Costs a few duplicate rows, which the
 * upsert absorbs, and buys immunity to a source that stamps a row a few seconds behind the
 * clock we read it with. Given that a missed row is unrecoverable, that trade is not close. */
const OVERLAP_SECONDS = 900;

export default {
  async scheduled(event, env, ctx) {
    // Deliberately NOT ctx.waitUntil. A long ETL passed to waitUntil can be cut short when
    // the invocation that scheduled it is torn down, which produces a partial load that
    // still reports success. Await it and let the run take as long as it takes.
    await runIngest(env);
  },

  // The same entry point by hand, for a backfill or a first run.
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/admin/ingest') return new Response('not found', { status: 404 });
    if (request.headers.get('authorization') !== `Bearer ${env.ADMIN_TOKEN}`) {
      return new Response('unauthorized', { status: 401 });
    }
    const report = await runIngest(env, { since: url.searchParams.get('since') });
    return Response.json(report);
  },
};

/* ------------------------------------------------------------------ */

export async function runIngest(env, opts = {}) {
  const startedAt = Date.now();
  const report = {
    startedAt,
    fetched: 0,
    deduped: 0,
    written: 0,
    quarantined: 0,
    ok: false,
    error: null,
  };

  let watermark = null;

  try {
    await ensureSchema(env.DB);

    watermark = opts.since || (await readWatermark(env.DB));
    const from = new Date(Date.parse(watermark) - OVERLAP_SECONDS * 1000).toISOString();

    const rows = await fetchSource(env, from);
    report.fetched = rows.length;

    // Resolve every row against the dimension tables FIRST. A row whose foreign key does
    // not resolve is quarantined, never guessed at and never defaulted into a bucket. A
    // guessed attribution is worse than a missing one because it is invisible.
    const tenants = await loadTenantMap(env.DB);
    const good = [];
    const bad = [];

    for (const raw of rows) {
      const row = normalize(raw);
      if (!row.natural_key || !row.event_at) {
        bad.push({ raw, reason: 'missing_key_or_timestamp' });
        continue;
      }
      const tenantId = tenants.get(row.customer_code);
      if (!tenantId) {
        bad.push({ raw, reason: 'unresolved_customer' });
        continue;
      }
      good.push({ ...row, tenant_id: tenantId });
    }

    // The source can return the same natural key more than once inside one window. SQLite
    // rejects a multi-row upsert that touches the same conflict target twice in a single
    // statement, so this has to happen before the write, not in it. Last write wins.
    const byKey = new Map();
    for (const r of good) byKey.set(r.natural_key, r);
    const unique = [...byKey.values()];
    report.deduped = good.length - unique.length;

    report.written = await upsertFacts(env.DB, unique);
    report.quarantined = await writeQuarantine(env.DB, bad);

    // Advance the watermark ONLY on a clean run. If anything above threw, the next run
    // re-reads the same window, which is safe precisely because the write is idempotent.
    const newWatermark = maxTimestamp(unique) || watermark;
    await writeWatermark(env.DB, newWatermark);

    report.ok = true;
    report.watermark = newWatermark;
    return report;
  } catch (err) {
    report.error = String((err && err.message) || err);
    throw err;
  } finally {
    // Written on success AND failure. A run log that only records successes will show an
    // unbroken green history right up until someone asks why the numbers are short.
    report.finishedAt = Date.now();
    report.durationMs = report.finishedAt - startedAt;
    await logRun(env.DB, report).catch(e => console.error('run log failed', e));
  }
}

/* ------------------------------------------------------------------ */

async function upsertFacts(db, rows) {
  if (rows.length === 0) return 0;

  const cols = [
    'natural_key', 'tenant_id', 'event_at', 'status', 'location_code', 'quantity', 'ingested_at',
  ];
  const chunkSize = Math.max(1, Math.floor(MAX_BOUND_PARAMS / cols.length));
  const now = Date.now();
  let written = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => `(${cols.map(() => '?').join(',')})`).join(',');

    const bindings = [];
    for (const r of chunk) {
      bindings.push(
        r.natural_key, r.tenant_id, r.event_at, r.status, r.location_code, r.quantity, now
      );
    }

    // The upsert is what makes the whole pipeline re-runnable. Re-reading an overlapping
    // window, retrying a failed run, or replaying a backfill all converge on the same
    // state rather than duplicating rows.
    const sql = `
      INSERT INTO facts (${cols.join(',')})
      VALUES ${placeholders}
      ON CONFLICT (natural_key) DO UPDATE SET
        tenant_id     = excluded.tenant_id,
        event_at      = excluded.event_at,
        status        = excluded.status,
        location_code = excluded.location_code,
        quantity      = excluded.quantity,
        ingested_at   = excluded.ingested_at
    `;

    const res = await db.prepare(sql).bind(...bindings).run();
    written += (res.meta && res.meta.changes) || chunk.length;
  }

  return written;
}

async function writeQuarantine(db, bad) {
  if (bad.length === 0) return 0;

  const cols = ['reason', 'payload', 'seen_at'];
  const chunkSize = Math.max(1, Math.floor(MAX_BOUND_PARAMS / cols.length));
  const now = Date.now();
  let n = 0;

  for (let i = 0; i < bad.length; i += chunkSize) {
    const chunk = bad.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => '(?,?,?)').join(',');
    const bindings = [];
    for (const b of chunk) bindings.push(b.reason, JSON.stringify(b.raw).slice(0, 4000), now);

    await db
      .prepare(`INSERT INTO quarantine (${cols.join(',')}) VALUES ${placeholders}`)
      .bind(...bindings)
      .run();
    n += chunk.length;
  }

  return n;
}

/* ------------------------------------------------------------------ */

async function ensureSchema(db) {
  // batch() sends these as one round trip. D1 also caps the number of terms in a compound
  // SELECT well below stock SQLite, so any view built here should be verified against a
  // local D1 (`wrangler d1 execute --local`) before it reaches production. A migration that
  // drops views before recreating them can otherwise leave the read API with none at all.
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS facts (
        natural_key   TEXT PRIMARY KEY,
        tenant_id     TEXT NOT NULL,
        event_at      TEXT NOT NULL,
        status        TEXT,
        location_code TEXT,
        quantity      INTEGER,
        ingested_at   INTEGER NOT NULL
      )`),
    db.prepare(`CREATE INDEX IF NOT EXISTS idx_facts_tenant_date ON facts (tenant_id, event_at)`),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS quarantine (
        id      INTEGER PRIMARY KEY AUTOINCREMENT,
        reason  TEXT NOT NULL,
        payload TEXT NOT NULL,
        seen_at INTEGER NOT NULL
      )`),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ingest_state (
        k TEXT PRIMARY KEY,
        v TEXT NOT NULL
      )`),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS ingest_log (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        started_at  INTEGER NOT NULL,
        duration_ms INTEGER,
        fetched     INTEGER,
        written     INTEGER,
        quarantined INTEGER,
        ok          INTEGER,
        error       TEXT
      )`),
  ]);
}

async function readWatermark(db) {
  const row = await db
    .prepare(`SELECT v FROM ingest_state WHERE k = 'watermark'`)
    .first();
  // A first run with no watermark reads from epoch rather than from "now". Starting at now
  // would silently skip everything already sitting in the source.
  return (row && row.v) || '1970-01-01T00:00:00.000Z';
}

async function writeWatermark(db, iso) {
  await db
    .prepare(
      `INSERT INTO ingest_state (k, v) VALUES ('watermark', ?)
       ON CONFLICT (k) DO UPDATE SET v = excluded.v`
    )
    .bind(iso)
    .run();
}

async function logRun(db, r) {
  await db
    .prepare(
      `INSERT INTO ingest_log (started_at, duration_ms, fetched, written, quarantined, ok, error)
       VALUES (?,?,?,?,?,?,?)`
    )
    .bind(r.startedAt, r.durationMs, r.fetched, r.written, r.quarantined, r.ok ? 1 : 0, r.error)
    .run();
}

async function loadTenantMap(db) {
  const { results } = await db
    .prepare('SELECT customer_code, tenant_id FROM tenant_map')
    .all();
  // EXACT matches only. No prefix matching, no "contains", no inferring the tenant from an
  // id format. Every one of those shortcuts eventually attributes a row to the wrong
  // customer, and on a multi-tenant portal that is a data leak rather than a reporting bug.
  return new Map((results || []).map(r => [r.customer_code, r.tenant_id]));
}

/* ------------------------------------------------------------------ */

async function fetchSource(env, sinceIso) {
  const res = await fetch(`${env.SOURCE_URL}?since=${encodeURIComponent(sinceIso)}`, {
    headers: { authorization: `Bearer ${env.SOURCE_TOKEN}` },
    signal: AbortSignal.timeout(25_000),
  });

  if (!res.ok) throw new Error(`source ${res.status}`);

  const body = await res.json();

  // A source that silently truncates is the failure mode that looks most like success.
  // If it tells us it capped the response, treat that as an error so the watermark does
  // not advance past rows we never received.
  if (body.capped) throw new Error('source response was capped, widen the page or narrow the window');

  return Array.isArray(body.rows) ? body.rows : [];
}

function normalize(raw) {
  return {
    natural_key: str(raw.id),
    customer_code: str(raw.customer),
    event_at: toIso(raw.timestamp),
    status: str(raw.status),
    location_code: str(raw.site),
    quantity: Number.isFinite(+raw.qty) ? Math.trunc(+raw.qty) : null,
  };
}

function str(v) {
  return v === null || v === undefined ? null : String(v).trim() || null;
}

/**
 * Parse a source timestamp to ISO.
 *
 * Note the explicit day-first branch. `new Date("10/04/2026")` is parsed as US month-first
 * by every JS engine, so a day-first source silently yields the wrong date for every day of
 * the month above 12, and a plausible wrong one below it. That failure does not throw and
 * does not look wrong in a spot check, so the format has to be asserted rather than sniffed.
 */
function toIso(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return new Date(v).toISOString();

  const s = String(v).trim();

  const dmy = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (dmy) {
    const [, d, m, y, hh = '00', mm = '00', ss = '00'] = dmy;
    const iso = `${y}-${m}-${d}T${hh}:${mm}:${ss}.000Z`;
    const parsed = new Date(iso);
    // Round-trip check: a non-existent date such as 31/02 parses without throwing and rolls
    // forward. Comparing the components back catches it.
    if (
      Number.isNaN(parsed.getTime()) ||
      parsed.getUTCDate() !== +d ||
      parsed.getUTCMonth() + 1 !== +m
    ) {
      return null;
    }
    return iso;
  }

  const t = Date.parse(s);
  return Number.isNaN(t) ? null : new Date(t).toISOString();
}

function maxTimestamp(rows) {
  let max = null;
  for (const r of rows) if (r.event_at && (!max || r.event_at > max)) max = r.event_at;
  return max;
}
