/**
 * GET /api/orders?days=30
 *
 * Возвращает все заказы за период, сгруппированные по корзинам
 * (вкладкам как в кабинете Kaspi).
 */

import { getOrders, MS_PER_DAY } from './_lib/kaspi.js';
import { requireAuth } from './_lib/session.js';

function bucketFor(order) {
  const a = order.attributes || {};
  const s = a.state;
  const st = a.status;
  const isPreorder = a.preOrder === true ||
    (a.plannedDeliveryDate && a.plannedDeliveryDate > Date.now() + 86_400_000);

  if (isPreorder && s !== 'ARCHIVE') return 'preorder';
  if (s === 'ARCHIVE') return 'archive';
  if (st === 'APPROVED_BY_BANK') return 'new';
  if (s === 'SIGN_REQUIRED') return 'sign';
  if (s === 'PICKUP') return 'pickup';
  if (s === 'DELIVERY') return 'my_delivery';
  if (s === 'KASPI_DELIVERY') {
    if (st === 'CANCELLING' || st === 'CANCELLED' ||
        (st && st.startsWith('RETURN_')) || st === 'RETURNED') {
      return 'cancel_in_delivery';
    }
    return 'in_delivery';
  }
  return 'archive';
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  try {
    const days = parseInt(req.query.days || '30', 10);
    const clamped = Math.min(Math.max(days, 1), 90);
    const now = Date.now();
    const from = now - clamped * MS_PER_DAY;

    const allOrders = await getOrders(from, now);

    // Распределяем по корзинам
    const buckets = {
      new: [], my_delivery: [], sign: [], pickup: [],
      preorder: [], in_delivery: [], cancel_in_delivery: [], archive: [],
    };

    for (const o of allOrders) {
      const b = bucketFor(o);
      if (buckets[b]) buckets[b].push(o);
    }

    // Сортируем — новые сверху
    for (const key of Object.keys(buckets)) {
      buckets[key].sort((a, b) =>
        (b.attributes?.creationDate || 0) - (a.attributes?.creationDate || 0)
      );
    }

    res.status(200).json({
      updatedAt: now,
      days: clamped,
      total: allOrders.length,
      buckets: Object.fromEntries(
        Object.entries(buckets).map(([k, list]) => [k, {
          count: list.length,
          items: list.slice(0, 100), // максимум 100 на корзину
        }])
      ),
    });
  } catch (err) {
    console.error('Orders error:', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
