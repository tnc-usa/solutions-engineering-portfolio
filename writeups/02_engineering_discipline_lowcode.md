The engineering discipline low-code is missing

Low-code gets dismissed as toy software: fine for a form, not for anything that runs a business. I have spent the last few years proving the opposite, building and running roughly ten production apps for cash operations on AppSheet, Google Apps Script, and Google Sheets. The platform is not the limit. The discipline around it is. Here is the discipline I put in place, because none of it comes in the box.

Version control for code that lives in a cloud editor

Apps Script runs in Google's editor, not in a repo. There is no git history, no diff, no branch. Change something in the cloud and your local copy is silently stale, or the reverse. On a ten-project estate that drift is a real production risk.

So I built an indexer. It reads the live Apps Script source through the Apps Script API, fingerprints every live file, matches it against the working copy on disk, and flags anything that has drifted. Curated copies always win and are never overwritten; un-curated live files get pulled down read-only as verbatim snapshots. It runs in its own isolated project to contain the broad permission scope it needs, and it checks access in a dry run before it touches anything. The result is a single source of truth for code that the platform refuses to version itself.

Idempotency, so automation is safe to re-run

Most of these systems run on scheduled triggers, some every five minutes, indefinitely. A scheduled job that is not safe to re-run is a time bomb: a retry, an overlap, a double-fire, and you have duplicate records or corrupted state.

Every pipeline I build is idempotent. Running it twice gives the same result as running it once. Paths are anchored to fixed folders, never derived from where a file happens to sit, so a re-run cannot nest its output one level deeper each time. Writes are change-detected. Each stage is wrapped so one stage failing does not abort the rest. Destructive jobs carry a dry-run flag. None of this is glamorous. All of it is the difference between automation you trust and automation you babysit.

Systems that document themselves

Ten apps with deep relational models are not something you hold in your head. So the documentation generates itself: a scheduled pipeline extracts each app's schema, splits it into a fixed taxonomy of sections, and indexes it, so the docs are always current and a person or an AI agent can pull precise context without reading a thousand pages. One line of config onboards a new app into the whole pipeline.

A version on every file, a reason for every change

Every script carries a header: a semantic version, a dated changelog, the entry points, and an honest list of known limits. Fixes are recorded by root cause, not by symptom. When I change something, the header says why and what it supersedes. This is ordinary senior-engineer hygiene, and it is exactly what people assume a low-code developer skips.

What I take from it

The tools do not make the engineer. I have seen traditional codebases with none of this, and I have built low-code systems with all of it. If you are weighing low-code for anything that matters, the real question is not whether the platform is serious. It is whether the person building on it is. Drift detection, idempotency, self-documentation, and a real change history are what let you run a system for years without fear. That is the layer I bring, whatever the stack underneath.
