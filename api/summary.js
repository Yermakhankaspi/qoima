// =============================================================
//  GET /api/summary?days=30
//  Сводка по всем заказам за период. Большие периоды (30+ дней)
//  загружаются понедельно с пагинацией, чтобы уложиться в таймаут.
// =============================================================
import { getUser, fetchOrdersByStateChunked } from './_lib/shared.js';

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });
  if (!process.env.KASPI_API_TOKEN) {
    return res.status(500).json({ error: 'KASPI_API_TOKEN не настроен' });
  }

  const days = parseInt(req.query.days || '30', 10);
  const now = Date.now();
  const from = now - days * 86_400_000;

  // Запрашиваем все состояния параллельно
  const states = ['NEW', 'SIGN_REQUIRED', 'PICKUP', 'DELIVERY', 'KASPI_DELIVERY', 'ARCHIVE'];
  const results = await Promise.all(
    states.map(s => fetchOrdersByStateChunked(s, from, now).then(r => ({ state: s, ...r })))
  );

  const errors = {};
  const allOrders = [];
  const byState = {};
  for (const r of results) {
    byState[r.state] = r.orders.length;
    if (r.error) errors[r.state] = r.error;
    allOrders.push(...r.orders);
  }

  // Дедупликация по ID (заказы могут пересекаться между неделями)
  const seen = new Set();
  const uniqueOrders = allOrders.filter(o => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });

  const byStatus = {};
  let totalRevenue = 0;
  let completedRevenue = 0;
  for (const o of uniqueOrders) {
    const a = o.attributes || {};
    const st = a.status || 'UNKNOWN';
    byStatus[st] = (byStatus[st] || 0) + 1;
    if (typeof a.totalPrice === 'number') {
      totalRevenue += a.totalPrice;
      if (st === 'COMPLETED') completedRevenue += a.totalPrice;
    }
  }

  const dayMap = {};
  for (const o of uniqueOrders) {
    const a = o.attributes || {};
    if (!a.creationDate) continue;
    const d = new Date(a.creationDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    dayMap[key] = (dayMap[key] || 0) + 1;
  }
  const byDay = Object.entries(dayMap)
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const recent = [...uniqueOrders]
    .sort((a, b) => (b.attributes?.creationDate || 0) - (a.attributes?.creationDate || 0))
    .slice(0, 20)
    .map(o => ({
      id: o.id,
      code: o.attributes?.code,
      totalPrice: o.attributes?.totalPrice,
      state: o.attributes?.state,
      status: o.attributes?.status,
      creationDate: o.attributes?.creationDate,
      deliveryMode: o.attributes?.deliveryMode,
      customer: o.attributes?.customer,
    }));

  return res.status(200).json({
    days,
    total: uniqueOrders.length,
    byState,
    byStatus,
    totalRevenue,
    completedRevenue,
    byDay,
    recent,
    errors,
  });
}
