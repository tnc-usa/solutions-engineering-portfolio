# Sean Newton, Portfolio of Production Builds

I build operational software: the systems that run the work, not the ones that report on it
afterwards. Real-time coordination on Cloudflare Workers and Durable Objects, SQL data
platforms fed by scheduled ETL, AI wired into live products behind real cost controls, route
optimization on Google Cloud Fleet Routing, and mobile capture for crews in the field.

The stack follows the problem. I have shipped on edge compute, on Google Cloud, and on
low-code where low-code genuinely fits, and the interesting engineering is nearly always in
knowing which of those a given layer actually needs.

Three things sit behind that, and they are one career rather than three. Nearly two decades in
design: CAD kitchens and fitted furniture, and then the regional agency for the design system
itself. A sales record that runs from high-net-worth property through to enterprise B2B. And
the engineering above. Designing a specification with a customer in front of you and pricing it
while they watch is where the configurator instinct came from, and it is why I can run the
discovery as well as the build.

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
Claude API key server-side, with Turnstile bot verification, a hard daily spend cap, per-IP
rate limiting, input validation, KV response caching and graceful degradation. Twice the
right answer was to take the model out. A bundled 40,000-ZIP dataset does the sales-tax
arithmetic client-side instead: free, instant, and impossible to get wrong. And the driving
rules moved from a runtime AI call to authored static files, one per country, once a
token-heavy language proved unable to finish inside the Worker's time limit: a Greek lookup
went from three failed 26-second attempts to 43 milliseconds.

**A betting assistant that never places a bet** (`betcha`, run live in September 2026, now mothballed)
A personal tool for my own sports betting in Tennessee, where it is licensed. It reads prices
from a licensed odds aggregator, removes the bookmaker's margin from a sharp reference price,
flags the lines a sportsbook has mispriced against that consensus, sizes the stake by
fractional Kelly, keeps the ledger, grades each bet from the scores, and records closing line
value, which is the measure of whether the process works. Human-in-the-loop is the design:
nothing in it logs in to a sportsbook or places a wager, and I placed every bet by hand. A
Cloudflare Worker with D1, four cron jobs and a phone-first PWA; bet slips read from a
screenshot by a Claude vision model; a metered API client with a budget floor that stops
visibly rather than falling back to anything dearer; every sport, book and threshold a
config row. Player props were built, measured, found to carry no more edge than the main
markets, and left switched off. I mothballed it after a week of live use, because recording
each bet twice, once at the book and once in the app, was a chore, and I wrote the revival
procedure down before switching anything off.

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

- **[Putting route optimization into production for cash-in-transit](writeups/01_route_optimization.md)**:
  where a cloud route optimizer ends and the real engineering begins, the constraint layer,
  allocating crews under hard rules, and the idempotency that lets you automate without fear.

- **[The engineering discipline low-code is missing](writeups/02_engineering_discipline_lowcode.md)**:
  version control for cloud-editor code, idempotency, and self-documenting systems across a
  production estate.

- **[One person, thirteen production apps, and a desk full of AI agents](writeups/03_ai_native_solo_portfolio.md)**:
  what AI-native delivery means in practice, and what it does not.

- **[I built the software for a job I had done myself](writeups/08_bali_pools_erp.md)**:
  I started a pool business with a pickup and did the diagnosis and the repairs myself, then wrote
  the ERP and the technician's field app six months in and sold the business eight years later.
  Why the system came first and the growth followed it, and where the line really falls between
  the part of an expert process you can turn into a question and the part you cannot.

- **[Shipping an AI-powered product solo: the parts that aren't the AI](writeups/09_newroots_ai_native_product.md)**:
  the operational shell around a live LLM endpoint, server-side keys, spend caps, rate limits,
  caching, graceful degradation, and why you pin a model alias rather than a dated snapshot.

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
sean@tnc-usa.com · [tnc-usa.com](https://www.tnc-usa.com) ·
[newroots.tnc-usa.com](https://newroots.tnc-usa.com)
