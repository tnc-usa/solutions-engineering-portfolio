# Shipping an AI-powered product solo: the parts that aren't the AI

I built NewRoots USA (newroots.tnc-usa.com) to solve a small, real problem: when you move to
the US, you spend your first months converting things. Metric to imperial, foreign clothing
and shoe sizes, sales tax that is not on the shelf price, unfamiliar slang, different driving
rules. It is a public, installable web app: pick where you are from, and seven tools tailor
their answers to your origin and language across 24 locales. Two of those tools are backed
by Anthropic's Claude API; the rest run client-side or against a data feed.

The interesting part is not the model call. Wiring up an LLM is the easy ten percent. The
other ninety percent is the shell you put around it so it can sit on the open internet,
unauthenticated, without leaking your API key or your budget. That shell is the actual
engineering, and it is the same whatever model you call.

## The shell

The front end is a hand-built vanilla-JavaScript PWA with a service worker, so the offline
tools (units, sizes) work with no network at all. The AI tools call a single Cloudflare
Worker that fronts the Claude API. Everything that matters lives in the Worker:

- **The key never reaches the browser.** The Worker holds it; the client holds nothing.
- **Bot verification.** Every AI call carries a Cloudflare Turnstile token, verified server
  side before a single model token is spent.
- **A hard daily spend cap, per endpoint.** A date-stamped counter in KV; once the day's
  ceiling is hit, the endpoint stops calling the model and says so. A public AI endpoint
  without a cap is an invitation to wake up to a bill.
- **Per-IP rate limiting.** Thirty calls an hour per endpoint, again in KV.
- **Input validation.** Length caps, an alphanumeric-ratio check, and a repeated-character
  check reject obvious junk before it costs a model call.
- **Response caching.** Answers are cached in KV for weeks. Most lookups are repeats, so most
  lookups are instant and free.
- **Graceful degradation.** If the model call fails, the Worker reaches for a cached answer
  before returning a clean error. The app bends instead of breaking.

None of that is glamorous. All of it is what separates a demo from something you can leave
running.

## Sometimes the right amount of AI is none

The first version of the sales-tax tool asked a model to guess the rate for a ZIP code. It was
confidently wrong often enough to be useless. I replaced it with a bundled, verified dataset of
about forty thousand US ZIP codes that resolves in the browser, with no model call at all.
Picking the model is the easy decision. Knowing when not to reach for one is the useful one.

## The lesson I paid for: pin to the alias, not the snapshot

A live AI product has a dependency most apps do not: the model itself changes. I learned this
the direct way. Two of the three AI tools went dark while the third kept working. The cause
was a single string: the two broken endpoints pinned a dated model snapshot, and that snapshot
had reached its retirement date and started returning a 404 "not found". The third endpoint
used a different, still-current model, so it was fine. The app was degrading exactly as
designed, but on a failure I had not designed for.

What I changed, and what I would tell anyone shipping on a hosted model:

- **Pin the minor-version alias, not a dated snapshot.** Dated snapshots retire on a published
  schedule and then 404. The bare alias tracks the minor version and survives.
- **Centralize the model ID in one constant.** One place to read, one place to change.
- **Surface "model not found" as its own error.** A retired model should shout in your logs,
  not hide inside a generic "lookup failed".
- **Watch the deprecation calendar.** It is the one dependency that expires on a date someone
  else picked.

## Honest limits

NewRoots is not finished. Monetization is scaffolding: the pricing tiers are in the UI, but no
payment rail is wired up, so it earns nothing today. Full UI translation covers eight of the
twenty-four locales; the rest fall back to English. The tax dataset is a verified community
snapshot I refresh by hand. I would rather say that plainly than oversell it.

AI made this fast to build. It did not make the operational discipline optional. The model is
leverage; the shell around it is the product.
