// =============================================================
//  GET /api/orders?state=NEW&days=30
//  Прокси к Kaspi API. По умолчанию — состояние NEW.
//  Можно передать любое из: NEW, SIGN_REQUIRED, PICKUP,
//  DELIVERY, KASPI_DELIVERY, ARCHIVE.
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

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });

  const token = process.env.KASPI_API_TOKEN;
  if (!token) return res.status(500).json({ error: 'KASPI_API_TOKEN не настроен' });

  const days = parseInt(req.query.days || '30', 10);
  const state = req.query.state || 'NEW';
  const pageSize = parseInt(req.query.size || '100', 10);
  const pageNumber = parseInt(req.query.page || '0', 10);

  const now = Date.now();
  const from = now - days * 86_400_000;

  const params = new URLSearchParams({
    'page[number]': String(pageNumber),
    'page[size]': String(pageSize),
    'filter[orders][state]': state,
    'filter[orders][creationDate][$ge]': String(from),
    'filter[orders][creationDate][$le]': String(now),
  });

  const url = `https://kaspi.kz/shop/api/v2/orders?${params.toString()}`;

  try {
    const upstream = await fetch(url, {
      headers: {
        'Accept': 'application/vnd.api+json',
        'Content-Type': 'application/vnd.api+json',
        'X-Auth-Token': token,
      },
    });
    const text = await upstream.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }
    if (!upstream.ok) {
      return res.status(upstream.status).json({
        error: `Kaspi вернул ${upstream.status}`,
        details: data,
      });
    }
    return res.status(200).json(data);
  } catch (err) {
    return res.status(502).json({ error: 'Не удалось связаться с Kaspi', details: err.message });
  }
}
