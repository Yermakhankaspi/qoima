// =============================================================
//  GET /api/summary
//  Один запрос, который параллельно запрашивает Kaspi
//  по всем основным состояниям и возвращает агрегированную
//  статистику. Используется на дашборде и странице "Продажи".
//  Требует авторизации.
// =============================================================
import { Redis } from '@upstash/redis';

function getRedis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  return new Redis({ url, token });
}

function parseCookies(str) {
  return (str || '').split(';').reduce((acc, c) => {
    const [k, ...rest] = c.trim().split('=');
    if (k) acc[k] = decodeURIComponent(rest.join('=') || '');
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
  } catch { return null; }
}

async function fetchOrdersByState(token, state, fromMs, toMs) {
  const params = new URLSearchParams({
    'page[number]': '0',
    'page[size]': '100',
    'filter[orders][state]': state,
    'filter[orders][creationDate][$ge]': String(fromMs),
    'filter[orders][creationDate][$le]': String(toMs),
  });
  const url = `https://kaspi.kz/shop/api/v2/orders?${params.toString()}`;
  try {
    const r = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'X-Auth-Token': token,
      },
    });
    if (!r.ok) return [];
    const data = await r.json();
    return data.data || [];
  } catch {
    return [];
  }
}

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });

  const kaspiToken = process.env.KASPI_API_TOKEN;
  if (!kaspiToken) return res.status(500).json({ error: 'KASPI_API_TOKEN не настроен' });

  const days = parseInt(req.query.days || '30', 10);
  const now = Date.now();
  const from = now - days * 86_400_000;

  // Параллельно запрашиваем заказы по всем основным состояниям
  const states = ['NEW', 'SIGN_REQUIRED', 'PICKUP', 'DELIVERY', 'KASPI_DELIVERY', 'ARCHIVE'];
  const results = await Promise.all(
    states.map(s => fetchOrdersByState(kaspiToken, s, from, now))
  );

  // Объединяем
  const allOrders = [];
  const byState = {};
  states.forEach((s, i) => {
    byState[s] = results[i].length;
    allOrders.push(...results[i]);
  });

  // Считаем по статусам
  const byStatus = {};
  let totalRevenue = 0;
  let completedRevenue = 0;
  for (const o of allOrders) {
    const a = o.attributes || {};
    const st = a.status || 'UNKNOWN';
    byStatus[st] = (byStatus[st] || 0) + 1;
    if (typeof a.totalPrice === 'number') {
      totalRevenue += a.totalPrice;
      if (st === 'COMPLETED') completedRevenue += a.totalPrice;
    }
  }

  // Сводка по дням (для страницы "Продажи")
  const dayMap = {};
  for (const o of allOrders) {
    const a = o.attributes || {};
    if (!a.creationDate) continue;
    const d = new Date(a.creationDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dayMap[key] = (dayMap[key] || 0) + 1;
  }
  const byDay = Object.entries(dayMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  // Последние 20 заказов
  const recent = [...allOrders]
    .sort((a, b) => (b.attributes?.creationDate || 0) - (a.attributes?.creationDate || 0))
    .slice(0, 20)
    .map(o => ({
      id: o.id,
      code: o.attributes?.code,
      totalPrice: o.attributes?.totalPrice,
      state: o.attributes?.state,
      status: o.attributes?.status,
      creationDate: o.attributes?.creationDate,
      deliveryMode: o.attributes?.deliveryMode,
      customer: o.attributes?.customer,
    }));

  return res.status(200).json({
    days,
    total: allOrders.length,
    byState,
    byStatus,
    totalRevenue,
    completedRevenue,
    byDay,
    recent,
  });
}
