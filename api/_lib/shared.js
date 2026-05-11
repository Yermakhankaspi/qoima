// =============================================================
//  api/_lib/shared.js
//  Общие функции: подключение к Redis, проверка авторизации,
//  работа с Kaspi API.
// =============================================================
import { Redis } from '@upstash/redis';

export function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

export function parseCookies(str) {
  return (str || '').split(';').reduce((acc, c) => {
    const [k, ...rest] = c.trim().split('=');
    if (k) acc[k] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});
}

export async function getUser(req) {
  const redis = getRedis();
  if (!redis) return null;
  const cookies = parseCookies(req.headers.cookie);
  if (!cookies.session) return null;
  try {
    const userId = await redis.get(`session:${cookies.session}`);
    if (!userId) return null;
    return await redis.get(`user:${userId}`);
  } catch { return null; }
}

// Универсальный запрос к Kaspi API с таймаутом
export async function kaspiFetch(path, opts = {}) {
  const token = process.env.KASPI_API_TOKEN;
  if (!token) throw new Error('KASPI_API_TOKEN не настроен');

  const url = path.startsWith('http') ? path : `https://kaspi.kz/shop/api/v2${path}`;
  const timeoutMs = opts.timeoutMs || 7000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const r = await fetch(url, {
      method: opts.method || 'GET',
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'X-Auth-Token': token,
        ...(opts.headers || {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    clearTimeout(timer);

    const text = await r.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    return { ok: r.ok, status: r.status, data };
  } catch (e) {
    clearTimeout(timer);
    return { ok: false, status: 0, error: e.name === 'AbortError' ? 'timeout' : e.message };
  }
}

// Запрос заказов по одному состоянию (одна страница)
export async function fetchOrdersByState(state, fromMs, toMs, page = 0, size = 100) {
  const params = new URLSearchParams({
    'page[number]': String(page),
    'page[size]': String(size),
    'filter[orders][state]': state,
    'filter[orders][creationDate][$ge]': String(fromMs),
    'filter[orders][creationDate][$le]': String(toMs),
  });
  const r = await kaspiFetch(`/orders?${params.toString()}`);
  if (!r.ok) return { orders: [], error: r.error || `HTTP ${r.status}` };
  return { orders: r.data.data || [], meta: r.data.meta, error: null };
}

// Запрос заказов по состоянию с разбиением по неделям и пагинацией —
// чтобы уложиться в 10-секундный лимит Vercel даже на больших объёмах.
export async function fetchOrdersByStateChunked(state, fromMs, toMs) {
  const WEEK = 7 * 86_400_000;
  const chunks = [];
  for (let t = fromMs; t < toMs; t += WEEK) {
    chunks.push([t, Math.min(t + WEEK, toMs)]);
  }
  // Параллельно запрашиваем все недельные окна
  const results = await Promise.all(
    chunks.map(async ([from, to]) => {
      // Внутри окна можем получить много страниц — берём максимум 3 страницы
      const all = [];
      let errors = null;
      for (let p = 0; p < 3; p++) {
        const r = await fetchOrdersByState(state, from, to, p, 100);
        if (r.error) { errors = r.error; break; }
        all.push(...r.orders);
        if (r.orders.length < 100) break;
      }
      return { orders: all, error: errors };
    })
  );
  const allOrders = [];
  let firstError = null;
  for (const r of results) {
    allOrders.push(...r.orders);
    if (r.error && !firstError) firstError = r.error;
  }
  return { orders: allOrders, error: firstError };
}
