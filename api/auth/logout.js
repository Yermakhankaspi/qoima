// =============================================================
//  POST /api/auth/logout
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
  try {
    const cookies = parseCookies(req.headers.cookie);
    const redis = getRedis();
    if (redis && cookies.session) {
      await redis.del(`session:${cookies.session}`);
    }
  } catch {}
  res.setHeader('Set-Cookie', `session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`);
  return res.status(200).json({ ok: true });
}
