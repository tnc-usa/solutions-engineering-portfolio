# Sean Newton - Solutions Engineering Portfolio

Solutions Engineer in payments, cash automation, and route optimization. A salesperson who
builds. I design and run production logistics and cash-operations platforms on AppSheet, Google
Apps Script, Google Cloud, and BigQuery, and I operate AI-native, primarily through AI agents.

This repository is a hub for my written work and a set of representative, sanitized code samples
from the tooling behind it. Client engagements are generalized: no client names, data, or
figures appear here, and one engagement is under an NDA and is described only in general terms.

## Writeups

- **Putting route optimization into production for cash-in-transit** - where a cloud route
  optimizer ends and the real engineering begins: the constraint layer, allocating crews under
  hard rules, and the idempotency that lets you automate without fear.
  LinkedIn: https://www.linkedin.com/pulse/putting-route-optimization-production-cash-in-transit-sean-newton-iafpe
  Local copy: [writeups/01_route_optimization.md](writeups/01_route_optimization.md)

- **The engineering discipline low-code is missing** - version control for cloud-editor code,
  idempotency, and self-documenting systems across a ten-app production estate.
  LinkedIn: https://www.linkedin.com/posts/sean-newton-a33a44402_lowcode-appsheet-googleappsscript-ugcPost-7472735238687965184-iTst
  Local copy: [writeups/02_engineering_discipline_lowcode.md](writeups/02_engineering_discipline_lowcode.md)

- **One person, ten production apps, and a desk full of AI agents** - what AI-native delivery
  actually means, and what it does not.
  LinkedIn: https://www.linkedin.com/posts/sean-newton-a33a44402_aiagents-appliedai-solutionsengineering-ugcPost-7472735885827162112--pR3
  Local copy: [writeups/03_ai_native_solo_portfolio.md](writeups/03_ai_native_solo_portfolio.md)

## Code samples

Representative, runnable samples of the production tooling described above. Synthetic
configuration, no client data. See [code-samples/README.md](code-samples/README.md).

- **[code-samples/drift-indexer.gs](code-samples/drift-indexer.gs)** - version control for code
  that lives in a cloud editor: reads live Apps Script source through the Apps Script API,
  fingerprints it, and reports drift against a baseline.
- **[code-samples/drive-backup.gs](code-samples/drive-backup.gs)** - config-driven
  disaster-recovery backup with per-source scheduling, dynamic header mapping, per-item error
  isolation, and an audit log.
- **[code-samples/idempotent-pipeline.gs](code-samples/idempotent-pipeline.gs)** - the skeleton
  every scheduled job follows: single lock, isolated stages, change-detected key-based writes,
  anchored output paths, and a dry-run flag.

## About

- Production route optimization on Google Cloud Fleet Routing (capacity, time windows, stop
  consolidation, diversion handling) and a custom constraint-solver crew and vehicle allocator.
- Two-way API integration, OAuth2 service accounts, webhooks, idempotent ETL, and BigQuery
  analytics across ~35-table relational models.
- Pre-sales discovery, solution design, demos, and proof-of-value delivery.

## Contact

Sean Newton, Tennessee, USA
LinkedIn: https://www.linkedin.com/in/sean-newton-a33a44402
Email: sean@tnc-usa.com
