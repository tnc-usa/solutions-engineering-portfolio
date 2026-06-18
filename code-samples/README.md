# Code samples

Representative, runnable samples of the production tooling behind my writeups. They are
sanitized: synthetic IDs and configuration, no client data or business logic. Each is the
pattern I run in production, written clean for reading.

Three are Google Apps Script; one (`ai-proxy-worker.js`) is a Cloudflare Worker. For an Apps
Script file: create a project, paste the file, replace the synthetic IDs in its config with
real ones, and add the OAuth scopes noted in the header to `appsscript.json`. For the Worker:
deploy with `wrangler`, set the secrets and KV bindings named in its header, and point your
app's origin at it.

## Files

- **drift-indexer.gs** - Version control for code that lives in a cloud editor. Apps Script has
  no native git history; this reads the live source of one or more projects through the Apps
  Script API, fingerprints every file, and reports what has drifted from a stored baseline.
  Curated baselines win; it only reports, it never overwrites a working copy.

- **drive-backup.gs** - A disaster-recovery backup layer, not a cron-copy. Reads a `datasources`
  table (Sheet, tab, folder, or file) and copies each due source into a dated folder, with
  per-source scheduling, dynamic header mapping (resilient to column reordering), per-item
  error isolation, and a structured audit log.

- **idempotent-pipeline.gs** - The skeleton every scheduled job in my estate follows: a single
  lock so runs never overlap, stages isolated so one failure does not abort the rest,
  change-detected key-based writes so a re-run produces the same result, output paths anchored
  to a fixed root, and a dry-run flag on anything destructive. Safe to run every five minutes,
  indefinitely.

- **ai-proxy-worker.js** - The pattern behind an AI-powered product (NewRoots USA): a
  Cloudflare Worker that fronts the Anthropic Claude API for a public, unauthenticated web
  app. Keeps the API key server-side and adds the controls a live AI endpoint needs: Turnstile
  bot verification, a hard daily spend cap, per-IP rate limiting, input validation, KV response
  caching, and graceful degradation. The model id sits in one constant, pinned to a
  minor-version alias (not a dated snapshot) so a model retirement cannot silently 404 the
  endpoint.

## A note on these samples

These illustrate patterns and engineering discipline, not any client's system. The production
implementations are larger and carry domain logic that stays private. What transfers, and what
these show, is how I build: versioned, documented, idempotent, and safe to automate.
