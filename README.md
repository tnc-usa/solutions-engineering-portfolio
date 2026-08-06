# Sean Newton, Portfolio of Production Builds

I build operational software: the systems that run the work, not the ones that report on it
afterwards. Real-time coordination on Cloudflare Workers and Durable Objects, SQL data
platforms fed by scheduled ETL, AI wired into live products behind real cost controls, route
optimization on Google Cloud Fleet Routing, and mobile capture for crews in the field.

The stack follows the problem. I have shipped on edge compute, on Google Cloud, and on
low-code where low-code genuinely fits, and the interesting engineering is nearly always in
knowing which of those a given layer actually needs. There is also a career sales record
behind the engineering, so I can run the discovery as well as the build.

This repository is the hub for my written work and a set of representative, sanitized code
samples from the systems described below. Client engagements are generalized: no client
names, data, or figures appear here, and one engagement is under an NDA and is described only
in general terms.

## Systems in production

**Real-time reconciliation at depot handover** (`boxroom`, live)
Two people counting the same sealed bags on two devices, with no shared view between them.
The existing field app syncs on an interval, so a scan crosses devices only after two sync
cycles, which makes a live shared tally impossible by design rather than by configuration.
Built the reconciliation layer as a Cloudflare Worker with one Durable Object per depot per
day: colocated SQLite, WebSocket Hibernation, and an offline-capable PWA with a replay queue.
A scan on any device lands on every other screen in under a second. The field app stayed
where it was and remains the system of record, updated through an async write-back.

**ATM operations warehouse and partner portal** (`atmops`, in delivery)
Reporting sat on a hosted BI tool reading a source system that hard-deletes its own history
on a rolling 30-day window, so there is no backfill and no trend beyond a month. Moved the
analytical store off the source entirely: Cloudflare Worker plus D1, a ten-minute cron ETL,
and the incumbent bucket logic ported rather than re-derived. Multi-tenant from the first
commit, so a second customer is one configuration row instead of a rebuild. Building it
surfaced a live cross-tenant fault the incumbent reports had been quietly reproducing,
records attributed to the wrong customer in both directions.

**Reporting layer over a live operational backend** (`cashtrace`, part-built)
A device-agnostic PWA that renders print-ready PDF reports over a live Sheets backend through
a thin JSON bridge, deliberately on a different stack to the operational apps it reports on.
Auth is email and password with PBKDF2 hashing, HMAC sessions, token-version revocation,
Turnstile, formula-injection sanitizing, and enumeration-neutral registration, all hardened
after an adversarial security review I commissioned against my own build.

**NewRoots USA** (live at [newroots.tnc-usa.com](https://newroots.tnc-usa.com))
An AI-native PWA with seven tools for people settling in the US, localized across 24 origin
countries. Hand-built vanilla-JS front end on Cloudflare Pages; a Worker holds the Anthropic
Claude API key server-side and routes by cost across two models, with Turnstile bot
verification, a hard daily spend cap, per-IP rate limiting, input validation, KV response
caching and graceful degradation. Where AI was the wrong tool, a bundled 40,000-ZIP dataset
does the sales-tax arithmetic client-side instead: free, instant, and impossible to get wrong.

**Route optimization for cash-in-transit** (under NDA, described in general terms)
A cloud optimizer returns an ordered list of stops, not a schedule an operation can run.
Google Cloud Fleet Routing solves the geometry; the constraint layer above it is custom, and
that is where the engineering lives: capacity ceilings, per-location time windows, stop
consolidation, precedence, automatic diversion handling, and a crew and vehicle allocator
working under hard rules. The pipeline is idempotent, so it can be re-run on the same day's
data and safely left on a schedule.

**A 13-app low-code estate on one shared backend**
Field capture, back-office control, depot logistics, IoT monitoring and settlement, across
three countries and one shared relational model of roughly 35 tables. Low-code at the glass
is the right call for crews on handsets. It is the wrong call for real-time state, for
analytics, and for anything an external party has to reach, which is exactly why the first
three systems above are not built on it.

**[tnc-usa.com](https://www.tnc-usa.com)**
The TNC Software LLC site, on Cloudflare Pages with a Google Apps Script lead-capture backend
(honeypot-filtered, logged to Sheets, email notification).

## Writeups

- **Putting route optimization into production for cash-in-transit**: where a cloud route
  optimizer ends and the real engineering begins, the constraint layer, allocating crews
  under hard rules, and the idempotency that lets you automate without fear.
  [LinkedIn](https://www.linkedin.com/pulse/putting-route-optimization-production-cash-in-transit-sean-newton-iafpe)
  · [local copy](writeups/01_route_optimization.md)

- **The engineering discipline low-code is missing**: version control for cloud-editor code,
  idempotency, and self-documenting systems across a production estate.
  [LinkedIn](https://www.linkedin.com/posts/sean-newton-a33a44402_lowcode-appsheet-googleappsscript-ugcPost-7472735238687965184-iTst)
  · [local copy](writeups/02_engineering_discipline_lowcode.md)

- **One person, ten production apps, and a desk full of AI agents**: what AI-native delivery
  means in practice, and what it does not.
  [LinkedIn](https://www.linkedin.com/posts/sean-newton-a33a44402_aiagents-appliedai-solutionsengineering-ugcPost-7472735885827162112--pR3)
  · [local copy](writeups/03_ai_native_solo_portfolio.md)

- **Shipping an AI-powered product solo: the parts that aren't the AI**: the operational shell
  around a live LLM endpoint, server-side keys, spend caps, rate limits, caching, graceful
  degradation, and why you pin a model alias rather than a dated snapshot.
  [local copy](writeups/09_newroots_ai_native_product.md)

## Code samples

Representative, runnable samples of the patterns behind the systems above. Synthetic
configuration, no client data. See [code-samples/README.md](code-samples/README.md).

- **[realtime-coordinator.js](code-samples/realtime-coordinator.js)**: the Durable Object
  pattern behind live shared state. Colocated SQLite, WebSocket Hibernation so idle sockets
  cost nothing, monotonic sequencing, idempotent scan handling, and a replay endpoint that
  lets a client that missed messages catch up without a full refetch.
- **[d1-etl-upsert.js](code-samples/d1-etl-upsert.js)**: the scheduled ETL pattern behind a
  warehouse whose source deletes its own history. Watermarked incremental pulls, in-JS dedupe,
  multi-row upserts batched under D1's bound-parameter ceiling, an explicit quarantine bucket
  for unresolvable rows, and a run log that makes a partial failure visible.
- **[ai-proxy-worker.js](code-samples/ai-proxy-worker.js)**: a Cloudflare Worker fronting the
  Anthropic Claude API for a public, unauthenticated app. Server-side keys, a hard daily spend
  cap, per-IP rate limiting, input validation, KV caching, and graceful degradation.
- **[drift-indexer.gs](code-samples/drift-indexer.gs)**: version control for code that lives
  in a cloud editor. Reads live Apps Script source through the Apps Script API, fingerprints
  it, and reports drift against a stored baseline.
- **[drive-backup.gs](code-samples/drive-backup.gs)**: config-driven disaster-recovery backup
  with per-source scheduling, dynamic header mapping, per-item error isolation, and an audit
  log.
- **[idempotent-pipeline.gs](code-samples/idempotent-pipeline.gs)**: the skeleton every
  scheduled job follows. One lock, isolated stages, change-detected key-based writes, anchored
  output paths, and a dry-run flag.

## What I build

- Real-time coordination on Cloudflare Workers and Durable Objects: colocated SQLite,
  WebSocket Hibernation, offline-capable PWAs with replay queues, sub-second shared state.
- Analytical stores on D1 with scheduled ETL, multi-tenancy from the first commit, and
  reconciliation against the incumbent report before anything is switched over.
- AI-powered products on the Anthropic Claude API: server-side proxying, hard cost caps,
  rate limiting, response caching and bot protection, plus the judgement to say when a bundled
  dataset beats a model call.
- Production route optimization on Google Cloud Fleet Routing with a custom constraint solver
  and crew and vehicle allocator.
- Two-way API integration, OAuth2 service accounts, webhooks, idempotent ETL, and BigQuery
  analytics over a relational model of roughly 35 tables.
- AI-native delivery: research, prototyping, documentation and much of the build run through
  AI agents (Claude Code, MCP-connected tools, multi-agent workflows), which compresses an
  integration or a proof-of-value pilot from weeks to hours. Leverage, not a crutch.
- Founder and operator: I have co-founded businesses, built the software that ran them, and
  sold them. The systems I built let owner-run companies operate remotely.
- Pre-sales discovery, solution design, demos and proof-of-value delivery, behind a career
  sales record across enterprise B2B and high-net-worth markets.

## Contact

Sean Newton, Tennessee, USA
[LinkedIn](https://www.linkedin.com/in/sean-newton-a33a44402) · sean@tnc-usa.com ·
[tnc-usa.com](https://www.tnc-usa.com)
