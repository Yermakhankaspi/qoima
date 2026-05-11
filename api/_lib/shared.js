const { Redis } = require("@upstash/redis");

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function parseCookies(str) {
  return (str || "").split(";").reduce((acc, item) => {
    const [key, ...rest] = item.trim().split("=");
    if (key) acc[key] = decodeURIComponent(rest.join("=") || "");
    return acc;
  }, {});
}

async function getUser(req) {
  const redis = getRedis();
  if (!redis) return null;
  const cookies = parseCookies(req.headers.cookie);
  if (!cookies.session) return null;
  try {
    const userId = await redis.get(`session:${cookies.session}`);
    if (!userId) return null;
    return await redis.get(`user:${userId}`);
  } catch {
    return null;
  }
}

async function kaspiFetch(path, opts = {}) {
  const token = process.env.KASPI_API_TOKEN;
  if (!token) throw new Error("KASPI_API_TOKEN не настроен");
  const url = path.startsWith("http") ? path : `https://kaspi.kz/shop/api/v2${path}`;
  const timeoutMs = opts.timeoutMs || 7000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      method: opts.method || "GET",
      headers: {
        Accept: "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        "X-Auth-Token": token,
        ...(opts.headers || {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: response.ok, status: response.status, data };
  } catch (error) {
    clearTimeout(timer);
    return { ok: false, status: 0, error: error.name === "AbortError" ? "timeout" : error.message };
  }
}

async function fetchOrdersByState(state, fromMs, toMs, page = 0, size = 100) {
  const params = new URLSearchParams({
    "page[number]": String(page),
    "page[size]": String(size),
    "filter[orders][state]": state,
    "filter[orders][creationDate][$ge]": String(fromMs),
    "filter[orders][creationDate][$le]": String(toMs),
  });
  const result = await kaspiFetch(`/orders?${params.toString()}`);
  if (!result.ok) return { orders: [], error: result.error || `HTTP ${result.status}` };
  return { orders: result.data.data || [], meta: result.data.meta, error: null };
}

async function fetchOrdersByStateChunked(state, fromMs, toMs) {
  const WEEK = 7 * 86_400_000;
  const chunks = [];
  for (let t = fromMs; t < toMs; t += WEEK) chunks.push([t, Math.min(t + WEEK, toMs)]);
  const results = await Promise.all(chunks.map(async ([from, to]) => {
    const all = [];
    let firstError = null;
    for (let page = 0; page < 3; page++) {
      const result = await fetchOrdersByState(state, from, to, page, 100);
      if (result.error) { firstError = result.error; break; }
      all.push(...result.orders);
      if (result.orders.length < 100) break;
    }
    return { orders: all, error: firstError };
  }));
  const allOrders = [];
  let firstError = null;
  for (const result of results) {
    allOrders.push(...result.orders);
    if (result.error && !firstError) firstError = result.error;
  }
  return { orders: allOrders, error: firstError };
}

module.exports = { getRedis, parseCookies, getUser, kaspiFetch, fetchOrdersByState, fetchOrdersByStateChunked };
