/**
 * drift-indexer.gs
 * Representative sample - live-vs-working-copy drift detection for Google Apps Script projects.
 *
 * Apps Script runs in a cloud editor with no native version control: no git history, no diff,
 * no branch. This tool reads the LIVE source of one or more Apps Script projects through the
 * Apps Script API, fingerprints every file, compares it against a stored baseline, and reports
 * what has drifted. It is the pattern I run in production across a multi-project estate to keep
 * a single source of truth for code the platform refuses to version itself.
 *
 * Sanitized, self-contained sample: synthetic project IDs, no client data. Curated baselines
 * always win; this sample only REPORTS drift, it never writes back to a project.
 *
 * appsscript.json oauthScopes:
 *   "https://www.googleapis.com/auth/script.projects.readonly",
 *   "https://www.googleapis.com/auth/script.external_request",
 *   "https://www.googleapis.com/auth/spreadsheets"
 *
 * Author:  Sean Newton (TNC Software LLC)
 * Version: 1.0.0
 * Changelog:
 *   1.0.0  Initial representative sample for portfolio publication.
 * Honest limits: container-bound scripts are not reachable by scriptId through the API and need
 *   a manual registry; the Apps Script API must be enabled for the executing account.
 */

var DRIFT_CONFIG = {
  // Synthetic. In production this list is generated, not hand-maintained.
  projects: [
    { name: 'OrdersEngine',   scriptId: 'SCRIPT_ID_ORDERS_ENGINE' },
    { name: 'RoutingService', scriptId: 'SCRIPT_ID_ROUTING_SVC' },
    { name: 'BackupTools',    scriptId: 'SCRIPT_ID_BACKUP_TOOLS' }
  ],
  baselineSheetId: 'SPREADSHEET_ID_DRIFT_BASELINE',
  baselineTab: 'drift_baseline'   // columns: key, hash
};

/** Trigger entry point: index every configured project and report drift. */
function indexDrift() {
  var ss = SpreadsheetApp.openById(DRIFT_CONFIG.baselineSheetId);
  var sheet = ss.getSheetByName(DRIFT_CONFIG.baselineTab) || ss.insertSheet(DRIFT_CONFIG.baselineTab);
  var baseline = readBaseline_(sheet);   // { "Project/file.type": hash }
  var seen = {};
  var report = [];

  DRIFT_CONFIG.projects.forEach(function (p) {
    var files;
    try {
      files = getLiveFiles_(p.scriptId);
    } catch (err) {
      report.push([p.name, '(whole project)', 'UNREACHABLE', String(err)]);
      return;   // one project failing never stops the rest
    }
    files.forEach(function (f) {
      var key = p.name + '/' + f.name + '.' + f.type;
      var hash = fingerprint_(f.source || '');
      seen[key] = true;
      if (!(key in baseline)) report.push([p.name, f.name, 'NEW', hash]);
      else if (baseline[key] !== hash) report.push([p.name, f.name, 'CHANGED', hash]);
      baseline[key] = hash;   // refresh the curated baseline; never writes to the project
    });
  });

  // anything in the baseline we did not see this run has been removed live
  Object.keys(baseline).forEach(function (key) {
    if (!seen[key]) report.push([key.split('/')[0], key, 'REMOVED', '']);
  });

  writeBaseline_(sheet, baseline);
  logReport_(ss, report);
  return report;
}

/** Read live project source through the Apps Script API. */
function getLiveFiles_(scriptId) {
  var url = 'https://script.googleapis.com/v1/projects/' + encodeURIComponent(scriptId) + '/content';
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('API ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  }
  return JSON.parse(res.getContentText()).files || [];
}

/** Stable content fingerprint (MD5 hex). */
function fingerprint_(text) {
  var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, text, Utilities.Charset.UTF_8);
  return bytes.map(function (b) { return ('0' + (b & 0xff).toString(16)).slice(-2); }).join('');
}

function readBaseline_(sheet) {
  var map = {};
  var values = sheet.getDataRange().getValues();
  for (var i = 1; i < values.length; i++) {   // row 0 = header
    if (values[i][0]) map[values[i][0]] = values[i][1];
  }
  return map;
}

function writeBaseline_(sheet, baseline) {
  var rows = [['key', 'hash']];
  Object.keys(baseline).sort().forEach(function (k) { rows.push([k, baseline[k]]); });
  sheet.clearContents();
  sheet.getRange(1, 1, rows.length, 2).setValues(rows);
}

function logReport_(ss, report) {
  if (!report.length) { Logger.log('No drift.'); return; }
  var tab = ss.getSheetByName('drift_report') || ss.insertSheet('drift_report');
  tab.clearContents();
  tab.getRange(1, 1, 1, 4).setValues([['project', 'file', 'status', 'detail']]);
  tab.getRange(2, 1, report.length, 4).setValues(report);
  Logger.log(report.length + ' drift item(s) written to drift_report.');
}

/** Read-only access check to run by hand before wiring this to a trigger. */
function dryRunAccessCheck() {
  DRIFT_CONFIG.projects.forEach(function (p) {
    try { getLiveFiles_(p.scriptId); Logger.log('OK   ' + p.name); }
    catch (e) { Logger.log('FAIL ' + p.name + ' :: ' + e.message); }
  });
}
