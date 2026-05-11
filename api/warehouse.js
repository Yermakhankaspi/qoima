// =============================================================
//  GET /api/warehouse?days=30
//  Агрегирует уникальные товары из заказов за период,
//  считает: продано, выручка, отменено.
//  Кешируется в Redis на 5 минут, чтобы не делать тысячи
//  запросов к Kaspi при каждом открытии страницы.
// =============================================================
import { getUser, getRedis, fetchOrdersByStateChunked, kaspiFetch } from './_lib/shared.js';

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });
  if (!process.env.KASPI_API_TOKEN) {
    return res.status(500).json({ error: 'KASPI_API_TOKEN не настроен' });
  }

  const days = parseInt(req.query.days || '30', 10);
  const now = Date.now();
  const from = now - days * 86_400_000;
  const redis = getRedis();
  const cacheKey = `warehouse:${days}d:${Math.floor(now / 300_000)}`;  // ключ меняется каждые 5 минут

  // 1. Проверяем кеш
  if (redis) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) return res.status(200).json({ ...cached, cached: true });
    } catch {}
  }

  // 2. Собираем все заказы (быстро)
  const states = ['NEW', 'PICKUP', 'DELIVERY', 'KASPI_DELIVERY', 'ARCHIVE'];
  const results = await Promise.all(
    states.map(s => fetchOrdersByStateChunked(s, from, now))
  );
  const allOrders = [];
  for (const r of results) allOrders.push(...r.orders);

  // Дедупликация
  const seen = new Set();
  const orders = allOrders.filter(o => {
    if (seen.has(o.id)) return false;
    seen.add(o.id);
    return true;
  });

  // 3. Для первых 25 заказов получаем товарные позиции (чтобы не превысить таймаут)
  // Для остальных — будут видны только агрегаты, без названий товаров
  const orderLimit = Math.min(orders.length, 25);
  const ordersToFetch = orders.slice(0, orderLimit);

  // Параллельно (но не более 5 одновременно через chunks)
  const productMap = new Map(); // productId -> { code, name, brand, sold, revenue, cancelled }

  async function processOrder(order) {
    const status = order.attributes?.status;
    const entriesRes = await kaspiFetch(`/orders/${order.id}/entries`, { timeoutMs: 4000 });
    if (!entriesRes.ok) return;
    const entries = entriesRes.data.data || [];

    for (const e of entries) {
      const productId = e.relationships?.product?.data?.id;
      if (!productId) continue;

      if (!productMap.has(productId)) {
        // Получаем карточку товара (один раз на продукт)
        const prodRes = await kaspiFetch(`/orderentries/${e.id}/product`, { timeoutMs: 3000 });
        productMap.set(productId, {
          productId,
          code: prodRes.ok ? prodRes.data.data?.attributes?.code : null,
          name: prodRes.ok ? prodRes.data.data?.attributes?.name : `ID ${productId}`,
          brand: prodRes.ok ? prodRes.data.data?.attributes?.brand : null,
          sold: 0,
          revenue: 0,
          cancelled: 0,
          orders: 0,
        });
      }
      const p = productMap.get(productId);
      const qty = e.attributes?.quantity || 1;
      const price = e.attributes?.totalPrice || 0;
      p.orders += 1;
      if (status === 'COMPLETED') {
        p.sold += qty;
        p.revenue += price;
      } else if (status === 'CANCELLED') {
        p.cancelled += qty;
      }
    }
  }

  // Обрабатываем порциями по 5 заказов параллельно
  for (let i = 0; i < ordersToFetch.length; i += 5) {
    const batch = ordersToFetch.slice(i, i + 5);
    await Promise.all(batch.map(processOrder));
  }

  const products = [...productMap.values()].sort((a, b) => b.sold - a.sold);

  const result = {
    days,
    totalOrders: orders.length,
    analyzedOrders: ordersToFetch.length,
    products,
  };

  // Сохраняем в кеш
  if (redis) {
    try { await redis.set(cacheKey, result, { ex: 300 }); } catch {}
  }

  return res.status(200).json(result);
}
