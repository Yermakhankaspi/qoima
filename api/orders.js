/**
 * GET /api/orders?days=30
 *
 * Возвращает все заказы за период, сгруппированные по корзинам.
 *
 * Логика распределения сделана как в кабинете Kaspi — чисто по статусу:
 *   - Возвраты → RETURNED, RETURN_*
 *   - Отменены → CANCELLED, CANCELLING
 *   - Выданы (архив) → COMPLETED
 *   - Предзаказы → если есть будущая дата получения
 *   - Новые → APPROVED_BY_BANK (ждут принятия продавцом)
 *   - На упаковке → ACCEPTED_BY_MERCHANT, ASSEMBLED
 *   - В доставке → PACKAGE_REGISTERED, HANDED_OVER_TO_COURIER, DELIVERED
 */

import { getOrders, MS_PER_DAY } from './_lib/kaspi.js';
import { requireAuth } from './_lib/session.js';

function bucketFor(order, now) {
  const a = order.attributes || {};
  const st = a.status;

  // 1. Возвраты — приоритет над всем (даже если есть будущая дата)
  if (st === 'RETURNED' || (st && st.startsWith('RETURN_'))) return 'returns';

  // 2. Отменённые
  if (st === 'CANCELLED' || st === 'CANCELLING') return 'cancelled';

  // 3. Выданные — это архив
  if (st === 'COMPLETED') return 'completed';

  // 4. Предзаказы — только активные с будущей датой получения
  const isPreorder = a.preOrder === true ||
    (a.plannedDeliveryDate && a.plannedDeliveryDate > now + MS_PER_DAY);
  if (isPreorder) return 'preorder';

  // 5. Новые — ждут принятия
  if (st === 'APPROVED_BY_BANK') return 'new';

  // 6. На упаковке
  if (st === 'ACCEPTED_BY_MERCHANT' || st === 'ASSEMBLED') return 'packing';

  // 7. В доставке
  if (st === 'PACKAGE_REGISTERED' || st === 'HANDED_OVER_TO_COURIER' || st === 'DELIVERED') {
    return 'delivery';
  }

  return 'other';
}

/**
 * Считает заказ просроченным, если он на упаковке больше 24 часов.
 */
function isOverdue(order, now) {
  const a = order.attributes || {};
  if (a.status !== 'ACCEPTED_BY_MERCHANT' && a.status !== 'ASSEMBLED') return false;
  return (now - a.creationDate) > MS_PER_DAY;
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  try {
    const days = parseInt(req.query.days || '30', 10);
    const clamped = Math.min(Math.max(days, 1), 90);
    const now = Date.now();
    const from = now - clamped * MS_PER_DAY;

    const allOrders = await getOrders(from, now);

    // Размечаем каждый заказ — добавляем признаки overdue и daysOverdue
    const enriched = allOrders.map(o => ({
      ...o,
      _overdue: isOverdue(o, now),
      _daysOverdue: isOverdue(o, now)
        ? Math.floor((now - o.attributes.creationDate) / MS_PER_DAY)
        : 0,
    }));

    // Распределяем
    const buckets = {
      new: [],
      packing: [],
      delivery: [],
      preorder: [],
      returns: [],
      cancelled: [],
      completed: [],
      other: [],
    };

    for (const o of enriched) {
      const b = bucketFor(o, now);
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
          items: list.slice(0, 100),
        }])
      ),
    });
  } catch (err) {
    console.error('Orders error:', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
