/**
 * idempotent-pipeline.gs
 * Representative sample - a scheduled pipeline that is safe to re-run.
 *
 * The discipline that separates a hobby script from production automation: a single lock so
 * runs never overlap, stages isolated so one failure does not abort the rest, change-detected
 * key-based writes so re-running produces the same result (no duplicates), output paths
 * anchored to a fixed root (never derived from a source file's location), and a DRY_RUN flag on
 * anything destructive. This is the skeleton every scheduled job in my estate follows.
 *
 * Sanitized sample: synthetic IDs, no business logic.
 * appsscript.json oauthScopes: "https://www.googleapis.com/auth/spreadsheets",
 *   "https://www.googleapis.com/auth/drive"
 *
 * Author:  Sean Newton (TNC Software LLC)
 * Version: 1.0.0
 * Changelog:
 *   1.0.0  Initial representative sample for portfolio publication.
 */

var PIPELINE = {
  rootFolderId: 'FOLDER_ID_PIPELINE_ROOT',   // all output anchored here, never to a source location
  ledgerSheetId: 'SPREADSHEET_ID_LEDGER',
  ledgerTab: 'work_items',                    // columns: key, status, payload, timestamp
  DRY_RUN: false
};

/** Trigger entry point. Safe to run every five minutes, indefinitely. */
function runPipeline() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { Logger.log('Locked by another run; exiting cleanly.'); return; }
  var results = [];
  try {
    [stageIngest_, stageTransform_, stagePublish_].forEach(function (stage) {
      try {
        results.push(stage.name + ': ' + stage());
      } catch (err) {
        results.push(stage.name + ': FAILED :: ' + err.message);   // isolate; continue
      }
    });
  } finally {
    lock.releaseLock();
  }
  Logger.log(results.join('  |  '));
  return results;
}

/** Ingest is idempotent: a key already in the ledger is skipped, so a re-run is a no-op. */
function stageIngest_() {
  var sheet = ledger_();
  var existing = keySet_(sheet);
  var added = 0;
  sampleIncoming_().forEach(function (item) {
    if (existing[item.key]) return;
    if (!PIPELINE.DRY_RUN) sheet.appendRow([item.key, 'INGESTED', item.payload, new Date()]);
    added++;
  });
  return added;
}

function stageTransform_() {
  return advanceStatus_('INGESTED', 'TRANSFORMED', function (payload) {
    return String(payload).trim().toUpperCase();   // representative transform
  });
}

function stagePublish_() {
  return advanceStatus_('TRANSFORMED', 'PUBLISHED', function (payload) { return payload; });
}

/**
 * Move rows from one status to the next, in place, by key. Change-detected: a row already at
 * the target status is skipped, so re-running never duplicates or regresses work. One batched
 * write, never row-by-row appends that could double up on retry.
 */
function advanceStatus_(fromStatus, toStatus, fn) {
  var sheet = ledger_();
  var rng = sheet.getDataRange();
  var values = rng.getValues();
  var c = headerIndex_(values[0], ['key', 'status', 'payload']);
  var changed = 0;
  for (var i = 1; i < values.length; i++) {
    if (values[i][c.status] !== fromStatus) continue;
    values[i][c.payload] = fn(values[i][c.payload]);
    values[i][c.status] = toStatus;
    changed++;
  }
  if (changed && !PIPELINE.DRY_RUN) rng.setValues(values);
  return changed;
}

/** Output goes to a dated subfolder under the fixed root, not under any source's parent. */
function outputFolder_(now) {
  var root = DriveApp.getFolderById(PIPELINE.rootFolderId);
  var label = Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
  var it = root.getFoldersByName(label);
  return it.hasNext() ? it.next() : root.createFolder(label);
}

function ledger_() {
  return SpreadsheetApp.openById(PIPELINE.ledgerSheetId).getSheetByName(PIPELINE.ledgerTab);
}

function keySet_(sheet) {
  var set = {};
  var values = sheet.getDataRange().getValues();
  var keyCol = values[0].indexOf('key');
  for (var i = 1; i < values.length; i++) set[values[i][keyCol]] = true;
  return set;
}

function headerIndex_(header, names) {
  var out = {};
  names.forEach(function (n) { out[n] = header.indexOf(n); });
  return out;
}

/** Deterministic stand-in so the sample runs without an external source. */
function sampleIncoming_() {
  return [
    { key: 'A-1001', payload: 'alpha' },
    { key: 'A-1002', payload: 'bravo' }
  ];
}
