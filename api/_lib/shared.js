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
  const timeoutMs = opts.timeoutMs || 10000;
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

async function fetchOrders(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") query.set(key, String(value));
  });

  const result = await kaspiFetch(`/orders?${query.toString()}`);
  if (!result.ok) {
    return { orders: [], meta: null, error: result.error || result.data?.message || result.data?.raw || `HTTP ${result.status}` };
  }
  return { orders: result.data?.data || [], meta: result.data?.meta || null, error: null };
}

async function fetchOrdersChunked(baseParams, fromMs, toMs, options = {}) {
  const chunkDays = options.chunkDays || 7;
  const pageLimit = options.pageLimit || 5;
  const pageSize = options.pageSize || 100;
  const chunkMs = chunkDays * 86_400_000;
  const chunks = [];

  for (let t = fromMs; t < toMs; t += chunkMs) chunks.push([t, Math.min(t + chunkMs, toMs)]);

  const results = await Promise.all(chunks.map(async ([from, to]) => {
    const collected = [];
    let firstError = null;
    for (let page = 0; page < pageLimit; page++) {
      const result = await fetchOrders({
        "page[number]": page,
        "page[size]": pageSize,
        "filter[orders][creationDate][$ge]": from,
        "filter[orders][creationDate][$le]": to,
        "include[orders]": "user",
        ...baseParams,
      });
      if (result.error) { firstError = result.error; break; }
      collected.push(...result.orders);
      if (result.orders.length < pageSize) break;
    }
    return { orders: collected, error: firstError };
  }));

  const seen = new Set();
  const orders = [];
  let error = null;
  for (const result of results) {
    if (result.error && !error) error = result.error;
    for (const order of result.orders) {
      const id = order.id || order.attributes?.code;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      orders.push(order);
    }
  }

  orders.sort((a, b) => (b.attributes?.creationDate || 0) - (a.attributes?.creationDate || 0));
  return { orders, error };
}

module.exports = { getRedis, parseCookies, getUser, kaspiFetch, fetchOrders, fetchOrdersChunked };
