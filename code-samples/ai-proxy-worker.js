/**
 * ai-proxy-worker.js  —  representative, sanitized sample
 *
 * The pattern behind NewRoots USA (newroots.tnc-usa.com): a Cloudflare Worker
 * that fronts the Anthropic Claude API for a public, unauthenticated web app.
 * Keep the API key server-side and put the controls a live AI product needs in
 * front of it: bot verification, a hard daily spend cap, per-IP rate limiting,
 * input validation, response caching, and graceful degradation.
 *
 * Sanitized: synthetic config, no secrets, no real KV ids, prompts trimmed to
 * skeletons. Bindings (set in wrangler.toml / dashboard):
 *   AI         secret      the Anthropic API key
 *   TURNSTILE  secret      the Cloudflare Turnstile secret key
 *   CACHE      KV          response cache
 *   LIMITS     KV          per-IP and daily-budget counters
 *
 * Lesson baked in (from a real outage): pin the model to the minor-version
 * ALIAS, never a dated snapshot. A dated snapshot is retired on a schedule and
 * then returns 404 not_found_error, silently taking the endpoint down. Keep the
 * id in one constant and surface not_found as its own error.
 */

// One place to change the model. Bare aliases track the minor version and are
// the durable choice; dated snapshots get retired.
const MODELS = {
  fast: "claude-haiku-4-5", // cheap, fast lookups
  smart: "claude-sonnet-4-6", // higher-quality structured answers
};

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

const DAILY_CAP = { fast: 5000, smart: 1500 }; // calls/day/endpoint (example)
const RATE_PER_HOUR = 30; // per IP, per endpoint
const CACHE_TTL = { fast: 60 * 60 * 24 * 30, smart: 60 * 60 * 24 * 90 }; // seconds

const CORS = {
  "Access-Control-Allow-Origin": "https://example.com", // your app origin
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...CORS },
  });
}

// UTC day stamp for date-keyed counters.
function dayKey(prefix) {
  return `${prefix}:${new Date().toISOString().slice(0, 10)}`; // prefix:YYYY-MM-DD
}

async function verifyTurnstile(token, ip, env) {
  if (!token) return false;
  const form = new FormData();
  form.append("secret", env.TURNSTILE);
  form.append("response", token);
  if (ip) form.append("remoteip", ip);
  const r = await fetch(
    "https://challenges.cloudflare.com/turnstile/v0/siteverify",
    { method: "POST", body: form },
  );
  const out = await r.json().catch(() => ({ success: false }));
  return !!out.success;
}

// Reject obvious junk before spending a model call.
function validInput(s, { max = 80 } = {}) {
  if (typeof s !== "string") return false;
  const t = s.trim();
  if (t.length < 1 || t.length > max) return false;
  const alphaRatio = (t.match(/[a-z0-9 ]/gi) || []).length / t.length;
  const longRepeat = /(.)\1{6,}/.test(t);
  return alphaRatio > 0.6 && !longRepeat;
}

async function underDailyCap(tier, env) {
  const key = dayKey(`cap:${tier}`);
  const used = parseInt((await env.LIMITS.get(key)) || "0", 10);
  if (used >= DAILY_CAP[tier]) return false;
  await env.LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 * 26 });
  return true;
}

async function underRateLimit(ip, endpoint, env) {
  const key = `rl:${endpoint}:${ip}:${new Date().getUTCHours()}`;
  const used = parseInt((await env.LIMITS.get(key)) || "0", 10);
  if (used >= RATE_PER_HOUR) return false;
  await env.LIMITS.put(key, String(used + 1), { expirationTtl: 60 * 60 });
  return true;
}

async function callClaude(model, maxTokens, system, user, env) {
  const r = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": env.AI,
      "anthropic-version": ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  const data = await r.json().catch(() => null);
  if (!r.ok) {
    const msg = data?.error?.message || String(r.status);
    // Make a retired-model 404 unmistakable in logs.
    if (data?.error?.type === "not_found_error") {
      throw new Error(`MODEL NOT FOUND (check model id / deprecation): ${msg}`);
    }
    throw new Error(`Anthropic error ${r.status}: ${msg}`);
  }
  return (data.content || [])
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
}

async function handleLookup({ tier, endpoint, term, env }) {
  const cacheKey = `${endpoint}:${term.toLowerCase()}`;

  const cached = await env.CACHE.get(cacheKey);
  if (cached) return json({ result: cached, cached: true });

  if (!(await underDailyCap(tier, env))) {
    return json({ error: "Daily limit reached, try again tomorrow." }, 429);
  }

  const text = await callClaude(
    MODELS[tier],
    400,
    "You are a concise assistant. Answer in strict JSON.",
    `Look up: ${term}`,
    env,
  );

  await env.CACHE.put(cacheKey, text, { expirationTtl: CACHE_TTL[tier] });
  return json({ result: text, cached: false });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const ip = request.headers.get("CF-Connecting-IP") || "";
    const endpoint = url.pathname.replace(/^\//, "") || "lookup";
    const tier = endpoint === "fast-lookup" ? "fast" : "smart";

    const body = request.method === "POST"
      ? await request.json().catch(() => ({}))
      : {};

    if (!(await verifyTurnstile(body.token, ip, env))) {
      return json({ error: "Verification failed." }, 403);
    }
    if (!(await underRateLimit(ip, endpoint, env))) {
      return json({ error: "Too many requests, slow down." }, 429);
    }
    if (!validInput(body.term)) {
      return json({ error: "Please enter a valid term." }, 400);
    }

    const term = body.term.trim();
    try {
      return await handleLookup({ tier, endpoint, term, env });
    } catch (err) {
      // Graceful degradation: serve a stale cache entry if we have one.
      const stale = await env.CACHE.get(`${endpoint}:${term.toLowerCase()}`);
      if (stale) return json({ result: stale, cached: true, degraded: true });
      return json({ error: "Lookup unavailable right now, try again." }, 503);
    }
  },
};
