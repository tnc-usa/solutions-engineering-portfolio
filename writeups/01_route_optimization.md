Putting route optimization into production for cash-in-transit

Most route-optimization demos solve a clean problem: a depot, a set of stops, a fleet, go. Cash-in-transit is not clean. You are routing vehicles and multi-role crews under hard constraints the textbook version ignores, and you are doing it again every single day because the inputs change every single day.

I built the operations platform for a regional cash-in-transit operator (the engagement is under NDA, so this stays generic). Here is how it actually went together, and where the real work was.

The shape of the problem

A day of CIT planning has to respect, all at once:
- Per-location time windows (a site that can only be serviced in a set window).
- Vehicle-capacity ceilings.
- Crew composition rules (roles that must or must not travel together, plus availability, leave, and maintenance).
- Risk and route constraints.
- Precedence (some stops before others).

Miss one and you do not get a slightly worse route. You get a plan that cannot legally or physically run.

The architecture

The platform runs on AppSheet, Google Apps Script, and Google Sheets over a roughly 35-table relational model, on scheduled triggers, so the daily plan builds itself instead of waiting on a planner. The routing math sits on Google Cloud Fleet Routing (the Maps Platform route-optimization service), integrated through an OAuth2 service account.

Fleet Routing is excellent at the core vehicle-routing problem. It does not know your business. So the engineering that matters is the layer on top.

The layer that does the work

Three pieces carried most of the value:

1. A constraint and exception-handling layer feeding the optimizer: capacity ceilings, per-location time windows, stop consolidation, precedence, and automatic diversion handling that reroutes around closed windows and cuts distance and idle time.

2. A custom constraint-solver allocator for the human side: assigning vehicles and multi-role crews under hard mutual-exclusion, org-unit isolation, and availability and maintenance constraints. This is the part no off-the-shelf router does, because it is about people and rules, not geography.

3. A template-driven order-decomposition and capacity-aware batching engine that turns the day's demand into routable work the optimizer can actually consume.

The unglamorous part that makes it trustworthy

Scheduled, automated planning only works if it is safe to re-run. The whole pipeline is idempotent: running it twice gives the same result as running it once. No duplicate stops, no double-allocated crews, no corruption when a trigger retries or a sync fires twice. Around it sits two-way API sync, automated backup, a live-versus-cloud indexer to catch drift, and a documentation pipeline, all under strict semantic versioning and root-cause changelog discipline.

That discipline is not decoration. In an operation where the plan drives real vehicles and real cash, "it usually works" is not a standard.

What I take from it

The lesson that transfers to any logistics operation: the optimizer is the easy 20 percent. The hard, valuable 80 percent is the constraint layer, the allocation of people under real rules, the idempotency that lets you automate without fear, and the data plumbing that turns a messy operation into something you can see and control.

I build that layer. If you run a logistics or dispatch operation and you are caught between spreadsheets and software built for the giants, that is the gap I work in.
