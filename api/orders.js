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
 *   - На упаковке → ACCEPTED_BY_MERCHANT, ASSEMBLE
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

  // 3. Приостановлены
  if (st === 'SUSPENDED') return 'suspended';

  // 4. Выданные — это архив
  if (st === 'COMPLETED') return 'completed';

  // 5. Предзаказы — только активные с будущей датой получения
  const isPreorder = a.preOrder === true ||
    (a.plannedDeliveryDate && a.plannedDeliveryDate > now + MS_PER_DAY);
  if (isPreorder) return 'preorder';

  // 6. Новые — ждут принятия
  if (st === 'APPROVED_BY_BANK') return 'new';

  // 7. ACCEPTED_BY_MERCHANT — здесь развилка по полю `assembled`
  //    и по факту передачи курьеру (для Kaspi-доставки)
  if (st === 'ACCEPTED_BY_MERCHANT') {
    // Уже отдан курьеру → В доставке
    if (a.kaspiDelivery && a.kaspiDelivery.courierTransmissionDate) {
      return 'delivery';
    }
    // Собран, ждёт курьера → Передача
    if (a.assembled === true) return 'transfer';
    // Иначе → Упаковка
    return 'packing';
  }

  // 8. ARRIVED — в доставке/прибыл (для не-Kaspi доставки)
  if (st === 'ARRIVED' || st === 'ARRIVED_BACKWARD') {
    return 'delivery';
  }

  return 'other';
}

/**
 * Считает заказ просроченным:
 *  - в "Упаковке" больше 24 часов (не успели собрать)
 *  - в "Передаче" больше 24 часов (не передали курьеру)
 */
function isOverdue(order, now) {
  const a = order.attributes || {};
  if (a.status !== 'ACCEPTED_BY_MERCHANT') return false;
  // Если уже отдан курьеру — не просрочен
  if (a.kaspiDelivery && a.kaspiDelivery.courierTransmissionDate) return false;
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
      transfer: [],
      delivery: [],
      preorder: [],
      returns: [],
      cancelled: [],
      suspended: [],
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
