// =============================================================
//  GET /api/auth/me
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

export default async function handler(req, res) {
  const redis = getRedis();
  if (!redis) {
    return res.status(500).json({ error: 'База данных не подключена. Открой /api/diag для диагностики.' });
  }

  const cookies = parseCookies(req.headers.cookie);
  const sessionId = cookies.session;
  if (!sessionId) return res.status(401).json({ error: 'Not logged in' });

  try {
    const userId = await redis.get(`session:${sessionId}`);
    if (!userId) return res.status(401).json({ error: 'Session expired' });

    const user = await redis.get(`user:${userId}`);
    if (!user) return res.status(401).json({ error: 'User not found' });

    return res.status(200).json({ user: { email: user.email, name: user.name } });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка базы данных: ' + err.message });
  }
}
