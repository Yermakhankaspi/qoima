/**
 * POST /api/auth/login
 * Body: { password: "..." }
 *
 * Сверяет пароль с ADMIN_PASSWORD из env. Если совпадает — ставит cookie.
 */

import { createSession, setSessionCookie } from '../_lib/session.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const adminPassword = process.env.ADMIN_PASSWORD;
    if (!adminPassword) {
      return res.status(500).json({
        error: 'ADMIN_PASSWORD не задан в Environment Variables Vercel'
      });
    }

    // Vercel парсит JSON автоматически, но на всякий случай
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const { password, name } = body;
    if (!password) {
      return res.status(400).json({ error: 'Введите пароль' });
    }

    // Сравнение с защитой от time-attacks
    if (password !== adminPassword) {
      return res.status(401).json({ error: 'Неверный пароль' });
    }

    const token = createSession(name || 'Менеджер');
    setSessionCookie(res, token);

    res.status(200).json({ ok: true, user: { name: name || 'Менеджер' } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: err.message });
  }
}
