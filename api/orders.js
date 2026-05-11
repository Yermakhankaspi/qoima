// GET /api/orders?state=NEW&days=30
import { getUser, fetchOrdersByStateChunked } from './_lib/shared.js';

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });
  if (!process.env.KASPI_API_TOKEN) {
    return res.status(500).json({ error: 'KASPI_API_TOKEN не настроен' });
  }

  const days = parseInt(req.query.days || '30', 10);
  const state = req.query.state || 'NEW';
  const now = Date.now();
  const from = now - days * 86_400_000;

  const result = await fetchOrdersByStateChunked(state, from, now);
  // Дедуплицируем
  const seen = new Set();
  const unique = result.orders.filter(o => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });
  // Сортируем по дате создания (новые сверху)
  unique.sort((a, b) => (b.attributes?.creationDate || 0) - (a.attributes?.creationDate || 0));

  return res.status(200).json({
    data: unique,
    error: result.error,
  });
}
