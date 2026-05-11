// GET /api/auth/me
import { getUser } from '../_lib/shared.js';

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Not logged in' });
  return res.status(200).json({ user: { email: user.email, name: user.name } });
}
