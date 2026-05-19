/**
 * POST /api/auth/logout
 * Очищает cookie с сессией.
 */

import { clearSessionCookie } from '../_lib/session.js';

export default async function handler(req, res) {
  clearSessionCookie(res);
  res.status(200).json({ ok: true });
}
