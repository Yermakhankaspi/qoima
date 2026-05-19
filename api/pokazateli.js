/**
 * GET /api/pokazateli
 *
 * Главный аналитический эндпоинт.
 * Возвращает агрегированные данные для дашборда «Показатели».
 */

import {
  getOrders, sumRevenue, groupByWeekday,
  startOfDay, startOfWeek, startOfMonth, MS_PER_DAY,
} from './_lib/kaspi.js';
import { requireAuth } from './_lib/session.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  try {
    const now = Date.now();
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

    // Заказы за последние 60 дней — этого хватит для всех агрегаций
    const sixtyDaysAgo = now - 60 * MS_PER_DAY;
    const allOrders = await getOrders(sixtyDaysAgo, now);

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
        count,
        revenue: curRev,
        diff,
        diffPct: pct,
        direction: diff >= 0 ? 'up' : 'down',
      };
    };

    // Просроченные: заказы, принятые продавцом, но не отправленные больше суток
    const overdueThreshold = now - MS_PER_DAY;
    const overdue = allOrders
      .filter(o =>
        o.attributes.status === 'ACCEPTED_BY_MERCHANT' &&
        o.attributes.creationDate < overdueThreshold
      )
      .map(o => ({
        id: o.id,
        code: o.attributes.code,
        sum: o.attributes.totalPrice,
        date: o.attributes.creationDate,
        daysOverdue: Math.floor((now - o.attributes.creationDate) / MS_PER_DAY),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // Возвраты
    const returns = allOrders
      .filter(o => {
        const st = o.attributes.status || '';
        return st === 'RETURNED' || st.startsWith('RETURN_');
      })
      .map(o => ({
        id: o.id,
        code: o.attributes.code,
        sum: o.attributes.totalPrice,
        date: o.attributes.creationDate,
      }))
      .sort((a, b) => b.date - a.date);

    // Новые заказы (требуют принятия)
    const newCount = allOrders.filter(o =>
      o.attributes.status === 'APPROVED_BY_BANK'
    ).length;

    // На упаковку
    const packingCount = allOrders.filter(o =>
      o.attributes.status === 'ACCEPTED_BY_MERCHANT' ||
      o.attributes.status === 'ASSEMBLED'
    ).length;

    res.status(200).json({
      updatedAt: now,
      totalOrders: allOrders.length,
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
      overdue: {
        count: overdue.length,
        sum: overdue.reduce((s, o) => s + o.sum, 0),
        list: overdue.slice(0, 10),
      },
      returns: {
        count: returns.length,
        sum: returns.reduce((s, o) => s + o.sum, 0),
        list: returns.slice(0, 10),
      },
      badges: {
        new: newCount,
        packing: packingCount,
      },
    });
  } catch (err) {
    console.error('Pokazateli error:', err);
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
