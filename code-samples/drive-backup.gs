/**
 * drive-backup.gs
 * Representative sample - config-driven Google Drive backup with an audit log.
 *
 * Reads a 'datasources' table (one row per thing to protect: a Sheet, a tab, a folder, or a
 * file) and on a schedule copies each due source into a dated backup folder, writing a
 * structured success/failure row to 'backup_logs'. Per-source frequency, dynamic header
 * mapping (resilient to column reordering), and per-item error isolation so one failure never
 * halts the run. A disaster-recovery layer under a production estate, not a cron-copy.
 *
 * Sanitized sample: synthetic IDs, no client data.
 * appsscript.json oauthScopes:
 *   "https://www.googleapis.com/auth/drive",
 *   "https://www.googleapis.com/auth/spreadsheets"
 *
 * Author:  Sean Newton (TNC Software LLC)
 * Version: 1.0.0
 * Changelog:
 *   1.0.0  Initial representative sample for portfolio publication.
 * Date safety: last_run is stored and read as a Date object, never parsed from a locale string.
 */

var BACKUP = {
  configSheetId: 'SPREADSHEET_ID_BACKUP_CONFIG',
  // 'datasources' columns: name, type, source_id, dest_folder_id, frequency_hours, last_run, active
  configTab: 'datasources',
  logTab: 'backup_logs'
};

/** Trigger entry point. */
function runBackups() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { Logger.log('Another backup run holds the lock; exiting.'); return; }
  try {
    var ss = SpreadsheetApp.openById(BACKUP.configSheetId);
    var cfg = ss.getSheetByName(BACKUP.configTab);
    var rows = cfg.getDataRange().getValues();
    var col = headerMap_(rows[0]);   // dynamic: lowercased header -> index
    var now = new Date();
    var logs = [];

    for (var i = 1; i < rows.length; i++) {
      var r = rows[i];
      if (String(r[col.active]).toLowerCase() === 'false') continue;
      if (!isDue_(r[col.last_run], r[col.frequency_hours], now)) continue;

      var name = r[col.name];
      try {
        var dest = getOrCreateDatedFolder_(r[col.dest_folder_id], now);
        var detail = backupOne_(r[col.type], r[col.source_id], dest, name, now);
        cfg.getRange(i + 1, col.last_run + 1).setValue(now);   // key-based write to this row only
        logs.push([now, name, r[col.type], 'OK', detail]);
      } catch (err) {
        logs.push([now, name, r[col.type], 'FAIL', String(err)]);   // isolated: keep going
      }
    }
    if (logs.length) appendLog_(ss, logs);
    Logger.log('Backup run complete: ' + logs.length + ' source(s) processed.');
  } finally {
    lock.releaseLock();
  }
}

function backupOne_(type, sourceId, destFolder, name, now) {
  switch (String(type).toLowerCase()) {
    case 'sheet':
    case 'file':
      DriveApp.getFileById(sourceId).makeCopy(name + ' ' + stamp_(now), destFolder);
      return 'copied ' + type;
    case 'folder':
      var n = copyFolder_(DriveApp.getFolderById(sourceId), destFolder.createFolder(name + ' ' + stamp_(now)));
      return 'copied folder (' + n + ' files)';
    default:
      throw new Error('Unknown source type: ' + type);
  }
}

function copyFolder_(src, dest) {
  var count = 0;
  var files = src.getFiles();
  while (files.hasNext()) { var f = files.next(); f.makeCopy(f.getName(), dest); count++; }
  var subs = src.getFolders();
  while (subs.hasNext()) { var s = subs.next(); count += copyFolder_(s, dest.createFolder(s.getName())); }
  return count;
}

/** Dated folder anchored to the configured destination, never to the source's location. */
function getOrCreateDatedFolder_(parentId, now) {
  var parent = DriveApp.getFolderById(parentId);
  var label = stamp_(now);
  var existing = parent.getFoldersByName(label);
  return existing.hasNext() ? existing.next() : parent.createFolder(label);
}

function isDue_(lastRun, freqHours, now) {
  if (!lastRun) return true;
  var hrs = (now.getTime() - new Date(lastRun).getTime()) / 3600000;
  return hrs >= Number(freqHours || 0);
}

function headerMap_(headerRow) {
  var map = {};
  headerRow.forEach(function (h, i) { map[String(h).trim().toLowerCase()] = i; });
  return map;
}

function appendLog_(ss, logs) {
  var tab = ss.getSheetByName(BACKUP.logTab) || ss.insertSheet(BACKUP.logTab);
  if (tab.getLastRow() === 0) tab.appendRow(['timestamp', 'name', 'type', 'status', 'detail']);
  tab.getRange(tab.getLastRow() + 1, 1, logs.length, 5).setValues(logs);
}

function stamp_(now) {
  return Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyy-MM-dd');
}
