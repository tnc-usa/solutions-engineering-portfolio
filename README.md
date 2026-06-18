# Sean Newton, Portfolio of Production Builds

A builder who ships, across software, design, and sales. I design and run production
cash-operations and route-optimization platforms on AppSheet, Google Apps Script, Google
Cloud, and BigQuery; I ship AI-powered products on Cloudflare and the Anthropic Claude API;
I work AI-native, primarily through AI agents; and there is a career sales record behind the
engineering. The range to move between code, design, and sales without losing depth in any
of them.

This repository is the hub for my written work and a set of representative, sanitized code
samples from the tooling behind it. Client engagements are generalized: no client names,
data, or figures appear here, and one engagement is under an NDA and is described only in
general terms.

## Products I've shipped

- **NewRoots USA** — an AI-native progressive web app with seven tools that help people
  settling in the US convert units, sizes, currency, sales tax, local terms, and driving
  rules, localized across 24 origin countries. Hand-built vanilla-JS PWA on Cloudflare Pages;
  a Cloudflare Worker holds the Anthropic Claude API key server-side and routes by cost across
  two models (Sonnet and Haiku), with bot protection, daily spend caps, rate limiting, and KV
  caching, plus a bundled ~40,000-ZIP dataset where AI was the wrong tool.
  Live: https://newroots.tnc-usa.com
- **tnc-usa.com** — the TNC Software LLC site, designed and shipped on Cloudflare Pages with
  a Google Apps Script lead-capture backend (spam-filtered, logged to Sheets, email
  notifications). Live: https://www.tnc-usa.com

## Writeups

- **Putting route optimization into production for cash-in-transit**: where a cloud route
  optimizer ends and the real engineering begins, the constraint layer, allocating crews
  under hard rules, and the idempotency that lets you automate without fear.
  LinkedIn: https://www.linkedin.com/pulse/putting-route-optimization-production-cash-in-transit-sean-newton-iafpe
  Local copy: [writeups/01_route_optimization.md](writeups/01_route_optimization.md)

- **The engineering discipline low-code is missing**: version control for cloud-editor code,
  idempotency, and self-documenting systems across a ten-app production estate.
  LinkedIn: https://www.linkedin.com/posts/sean-newton-a33a44402_lowcode-appsheet-googleappsscript-ugcPost-7472735238687965184-iTst
  Local copy: [writeups/02_engineering_discipline_lowcode.md](writeups/02_engineering_discipline_lowcode.md)

- **One person, ten production apps, and a desk full of AI agents**: what AI-native delivery
  actually means, and what it does not.
  LinkedIn: https://www.linkedin.com/posts/sean-newton-a33a44402_aiagents-appliedai-solutionsengineering-ugcPost-7472735885827162112--pR3
  Local copy: [writeups/03_ai_native_solo_portfolio.md](writeups/03_ai_native_solo_portfolio.md)

- **Shipping an AI-powered product solo: the parts that aren't the AI**: the operational
  shell around a live LLM endpoint, server-side keys, spend caps, rate limits, caching,
  graceful degradation, and why you pin a model alias, not a dated snapshot.
  Local copy: [writeups/09_newroots_ai_native_product.md](writeups/09_newroots_ai_native_product.md)

## Code samples

Representative, runnable samples of the production tooling described above. Synthetic
configuration, no client data. See [code-samples/README.md](code-samples/README.md).

- **[code-samples/drift-indexer.gs](code-samples/drift-indexer.gs)**: version control for
  code that lives in a cloud editor; reads live Apps Script source through the Apps Script
  API, fingerprints it, and reports drift against a baseline.
- **[code-samples/drive-backup.gs](code-samples/drive-backup.gs)**: config-driven
  disaster-recovery backup with per-source scheduling, dynamic header mapping, per-item
  error isolation, and an audit log.
- **[code-samples/idempotent-pipeline.gs](code-samples/idempotent-pipeline.gs)**: the
  skeleton every scheduled job follows, single lock, isolated stages, change-detected
  key-based writes, anchored output paths, and a dry-run flag.
- **[code-samples/ai-proxy-worker.js](code-samples/ai-proxy-worker.js)**: the pattern behind
  an AI-powered product, a Cloudflare Worker fronting the Anthropic Claude API with
  server-side keys, a daily spend cap, per-IP rate limiting, input validation, KV caching,
  and graceful degradation.

## What I build

- Production route optimization on Google Cloud Fleet Routing (capacity ceilings,
  per-location time windows, stop consolidation, precedence, automatic diversion handling)
  and a custom constraint-solver crew and vehicle allocator.
- Two-way API integration, OAuth2 service accounts, webhooks, idempotent ETL, and BigQuery
  analytics across relational data models of roughly 35 tables.
- AI-powered products on the Anthropic Claude API: a server-side Cloudflare Worker proxy
  with rate limiting, hard cost caps, response caching, and bot protection, the controls a
  live AI product actually needs.
- AI-native delivery: research, prototyping, documentation, and much of the build run
  through AI agents (Claude Code, MCP-connected tools, multi-agent workflows), which
  compresses an integration or a proof-of-value pilot from weeks to hours. AI as leverage,
  not a crutch.
- Founder and operator: I have co-founded businesses, built the software that ran them, and
  sold them; the ERPs I built let owner-run companies operate remotely.
- Pre-sales discovery, solution design, demos, and proof-of-value delivery, behind a career
  sales record across enterprise B2B and high-net-worth markets.

## Contact

Sean Newton, Tennessee, USA
LinkedIn: https://www.linkedin.com/in/sean-newton-a33a44402
Email: sean@tnc-usa.com
