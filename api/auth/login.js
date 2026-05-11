// POST /api/auth/login
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getRedis } from '../_lib/shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const redis = getRedis();
  if (!redis) return res.status(500).json({ error: 'База данных не подключена' });

  const { email, password } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });

  const emailLower = String(email).toLowerCase().trim();
  try {
    const userId = await redis.get(`user-by-email:${emailLower}`);
    if (!userId) return res.status(401).json({ error: 'Неверный email или пароль' });
    const user = await redis.get(`user:${userId}`);
    if (!user) return res.status(401).json({ error: 'Неверный email или пароль' });
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ error: 'Неверный email или пароль' });

    const sessionId = crypto.randomUUID();
    const TTL = 60 * 60 * 24 * 30;
    await redis.set(`session:${sessionId}`, userId, { ex: TTL });
    res.setHeader('Set-Cookie', `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TTL}`);
    return res.status(200).json({ user: { email: user.email, name: user.name } });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка БД: ' + err.message });
  }
}
