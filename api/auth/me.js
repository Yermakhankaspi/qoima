/**
 * GET /api/auth/me
 * Возвращает данные текущего пользователя или 401.
 */

import { getSessionFromRequest } from '../_lib/session.js';

export default async function handler(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    return res.status(401).json({ error: 'Не авторизован' });
  }
  res.status(200).json({ user: { name: session.user } });
}
