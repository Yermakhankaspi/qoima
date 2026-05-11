// =============================================================
//  GET /api/order-entries?orderId=XXX
//  Получить список товаров в заказе вместе с информацией
//  о каждом товаре (название, бренд).
// =============================================================
import { getUser, kaspiFetch } from './_lib/shared.js';

export default async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });

  const orderId = req.query.orderId;
  if (!orderId) return res.status(400).json({ error: 'orderId обязателен' });

  // 1. Список товарных позиций в заказе
  const entriesRes = await kaspiFetch(`/orders/${orderId}/entries`);
  if (!entriesRes.ok) {
    return res.status(entriesRes.status || 502).json({ error: entriesRes.error || 'Ошибка Kaspi API' });
  }
  const entries = entriesRes.data.data || [];

  // 2. Для каждой позиции — карточку товара (название, бренд)
  // Делаем параллельно с ограничением по таймауту
  const enriched = await Promise.all(
    entries.map(async (e) => {
      const prodRes = await kaspiFetch(`/orderentries/${e.id}/product`, { timeoutMs: 4000 });
      return {
        id: e.id,
        quantity: e.attributes?.quantity,
        totalPrice: e.attributes?.totalPrice,
        basePrice: e.attributes?.basePrice,
        deliveryCost: e.attributes?.deliveryCost,
        product: prodRes.ok ? {
          code: prodRes.data.data?.attributes?.code,
          name: prodRes.data.data?.attributes?.name,
          brand: prodRes.data.data?.attributes?.brand,
          category: prodRes.data.data?.attributes?.category,
        } : null,
      };
    })
  );

  return res.status(200).json({ data: enriched });
}
