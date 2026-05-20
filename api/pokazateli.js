/**
 * GET /api/pokazateli
 *
 * Возвращает счётчики в стиле кабинета Kaspi — текущее состояние заказов
 * прямо сейчас, плюс блок аналитики за месяц.
 */

import {
  getOrders, sumRevenue, groupByWeekday,
  startOfDay, startOfWeek, startOfMonth, MS_PER_DAY,
} from './_lib/kaspi.js';
import { requireAuth } from './_lib/session.js';

/**
 * Активный ли заказ (не отменён, не выдан, не возвращён).
 */
function isActive(o) {
  const st = o.attributes?.status;
  if (!st) return false;
  if (st === 'COMPLETED' || st === 'CANCELLED') return false;
  if (st === 'RETURNED' || st.startsWith('RETURN_')) return false;
  return true;
}

/**
 * Определить раздел Kaspi-кабинета для активного заказа.
 *
 * Ключевое: «Упаковка» и «Передача» — это ОДИН статус ACCEPTED_BY_MERCHANT,
 * разделённый по полю `assembled`:
 *   - assembled=false → Упаковка (ещё собирать)
 *   - assembled=true  → Передача (собран, ждёт курьера)
 *
 * А «Переданы на доставку» — это когда у KASPI_DELIVERY заполнен courierTransmissionDate.
 */
function kaspiSection(o, now) {
  const a = o.attributes || {};
  const st = a.status;

  // Предзаказы
  if (a.preOrder === true ||
      (a.plannedDeliveryDate && a.plannedDeliveryDate > now + MS_PER_DAY)) {
    return 'preorder';
  }

  if (st === 'APPROVED_BY_BANK') return 'new';

  // Главное: разделяем по полю assembled
  if (st === 'ACCEPTED_BY_MERCHANT') {
    // Если уже отправлен курьеру → "Переданы на доставку"
    if (a.kaspiDelivery && a.kaspiDelivery.courierTransmissionDate) {
      return 'in_delivery';
    }
    // Если собран, но курьер ещё не приехал → "Передача"
    if (a.assembled === true) return 'transfer';
    // Иначе ещё собирать → "Упаковка"
    return 'packing';
  }

  if (st === 'ARRIVED' || st === 'ARRIVED_BACKWARD') return 'in_delivery';
  if (st === 'CANCELLING') return 'cancelling';
  if (st === 'SUSPENDED') return 'suspended';

  return 'other';
}

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  try {
    const now = Date.now();

    // Берём за 90 дней — чтобы захватить все активные заказы (включая старые в доставке)
    const ninetyDaysAgo = now - 90 * MS_PER_DAY;
    const allOrders = await getOrders(ninetyDaysAgo, now);

    // ============ СЧЁТЧИКИ В СТИЛЕ KASPI (текущее состояние) ============
    // Считаем только АКТИВНЫЕ заказы (без отменённых, выданных, возвратов)
    const active = allOrders.filter(isActive);

    const sections = {
      preorder: 0,        // Предзаказ
      new: 0,             // Новые
      packing: 0,         // Упаковка
      transfer: 0,        // Передача
      in_delivery: 0,     // Переданы на доставку
      cancelling: 0,      // Отменены при доставке (в процессе)
      suspended: 0,       // Приостановлены
      other: 0,
    };

    for (const o of active) {
      const s = kaspiSection(o, now);
      if (sections[s] !== undefined) sections[s]++;
    }

    // Возвраты (текущее состояние)
    const returnsAll = allOrders.filter(o => {
      const st = o.attributes?.status || '';
      return st === 'RETURNED' || st.startsWith('RETURN_');
    });
    const returns = {
      new: returnsAll.filter(o => o.attributes.status === 'RETURN_REQUESTED_FROM_CUSTOMER').length,
      total: returnsAll.length,
      list: returnsAll
        .map(o => ({
          id: o.id,
          code: o.attributes.code,
          sum: o.attributes.totalPrice,
          date: o.attributes.creationDate,
        }))
        .sort((a, b) => b.date - a.date)
        .slice(0, 10),
    };

    // Просроченные заказы в "Упаковке" (висят > 24 часов)
    const overdueThreshold = now - MS_PER_DAY;
    const overdueList = active
      .filter(o => o.attributes.status === 'ACCEPTED_BY_MERCHANT' &&
                   o.attributes.creationDate < overdueThreshold)
      .map(o => ({
        id: o.id,
        code: o.attributes.code,
        sum: o.attributes.totalPrice,
        date: o.attributes.creationDate,
        daysOverdue: Math.floor((now - o.attributes.creationDate) / MS_PER_DAY),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // ============ АНАЛИТИКА ЗА ПЕРИОД ============
    const todayStart = startOfDay();
    const yesterdayStart = todayStart - MS_PER_DAY;
    const weekStart = startOfWeek();
    const prevWeekStart = weekStart - 7 * MS_PER_DAY;
    const monthStart = startOfMonth();
    const prevMonthStart = (() => {
      const d = new Date(monthStart);
      d.setMonth(d.getMonth() - 1);
      return d.getTime();
    })();

    const filterByRange = (from, to) =>
      allOrders.filter(o =>
        o.attributes.creationDate >= from && o.attributes.creationDate < to
      );

    const buildMetric = (current, previous) => {
      const curRev = sumRevenue(current);
      const prevRev = sumRevenue(previous);
      const diff = curRev - prevRev;
      const pct = prevRev > 0 ? Math.round((diff / prevRev) * 100) : 0;
      const count = current.filter(o => o.attributes.status === 'COMPLETED').length;
      return {
        count, revenue: curRev, diff, diffPct: pct,
        direction: diff >= 0 ? 'up' : 'down',
      };
    };

    res.status(200).json({
      updatedAt: now,
      totalOrders: allOrders.length,
      // Счётчики в стиле Kaspi-кабинета
      kaspi: {
        active: sections,
        returns,
        overdue: {
          count: overdueList.length,
          sum: overdueList.reduce((s, o) => s + o.sum, 0),
          list: overdueList.slice(0, 10),
        },
      },
      // Аналитика за период (выручка, сравнения)
      sales: {
        today: buildMetric(
          filterByRange(todayStart, now),
          filterByRange(yesterdayStart, todayStart)
        ),
        week: buildMetric(
          filterByRange(weekStart, now),
          filterByRange(prevWeekStart, weekStart)
        ),
        month: buildMetric(
          filterByRange(monthStart, now),
          filterByRange(prevMonthStart, monthStart)
        ),
      },
      chart: {
        current: groupByWeekday(filterByRange(weekStart, now)),
        previous: groupByWeekday(filterByRange(prevWeekStart, weekStart)),
      },
      // Бейджи для меню
      badges: {
        new: sections.new,
        packing: sections.packing,
        active: active.length,
      },
    });
  } catch (err) {
    console.error('Pokazateli error:', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
