// POST /api/auth/register
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { getRedis } from '../_lib/shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const redis = getRedis();
  if (!redis) return res.status(500).json({ error: 'База данных не подключена' });

  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: 'Email и пароль обязательны' });
  if (password.length < 6) return res.status(400).json({ error: 'Пароль слишком короткий' });

  const emailLower = String(email).toLowerCase().trim();
  try {
    const existing = await redis.get(`user-by-email:${emailLower}`);
    if (existing) return res.status(400).json({ error: 'Такой email уже зарегистрирован' });

    const userId = crypto.randomUUID();
    const user = {
      id: userId,
      email: emailLower,
      name: name || emailLower.split('@')[0],
      passwordHash: await bcrypt.hash(password, 10),
      createdAt: Date.now(),
    };
    await redis.set(`user:${userId}`, user);
    await redis.set(`user-by-email:${emailLower}`, userId);

    const sessionId = crypto.randomUUID();
    const TTL = 60 * 60 * 24 * 30;
    await redis.set(`session:${sessionId}`, userId, { ex: TTL });
    res.setHeader('Set-Cookie', `session=${sessionId}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${TTL}`);
    return res.status(200).json({ user: { email: user.email, name: user.name } });
  } catch (err) {
    return res.status(500).json({ error: 'Ошибка БД: ' + err.message });
  }
}
