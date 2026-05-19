/**
 * app/api/pokazateli/route.ts
 *
 * Endpoint: GET /api/pokazateli?period=week|month|year
 *
 * Возвращает агрегированные данные для страницы «Показатели»:
 *   - продажи сегодня / неделя / месяц + сравнение с прошлым периодом
 *   - график по дням текущей и прошлой недели
 *   - просроченные заказы (на упаковке > 24ч)
 *   - возвраты
 */

import { NextResponse } from 'next/server';
import {
  getOrders,
  sumRevenue,
  groupByWeekday,
  startOfDay,
  startOfWeek,
  startOfMonth,
} from '@/lib/kaspi';

export const dynamic = 'force-dynamic'; // не кэшировать на стороне Vercel

export async function GET(request: Request) {
  try {
    const now = Date.now();
    const todayStart = startOfDay();
    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const weekStart = startOfWeek();
    const prevWeekStart = weekStart - 7 * 24 * 60 * 60 * 1000;
    const monthStart = startOfMonth();
    const prevMonthStart = (() => {
      const d = new Date(monthStart);
      d.setMonth(d.getMonth() - 1);
      return d.getTime();
    })();

    // Все заказы за последние ~60 дней — этого хватит для всех агрегаций
    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;
    const allOrders = await getOrders({ fromMs: sixtyDaysAgo, toMs: now });

    // Сегментируем по периодам
    const filterByRange = (from: number, to: number) =>
      allOrders.filter(
        o => o.attributes.creationDate >= from && o.attributes.creationDate < to
      );

    const todayOrders = filterByRange(todayStart, now);
    const yesterdayOrders = filterByRange(yesterdayStart, todayStart);
    const weekOrders = filterByRange(weekStart, now);
    const prevWeekOrders = filterByRange(prevWeekStart, weekStart);
    const monthOrders = filterByRange(monthStart, now);
    const prevMonthOrders = filterByRange(prevMonthStart, monthStart);

    // Считаем «успешные» (выданные) — это идёт в выручку
    const countCompleted = (arr: typeof allOrders) =>
      arr.filter(o => o.attributes.status === 'COMPLETED').length;

    const buildMetric = (current: typeof allOrders, previous: typeof allOrders) => {
      const curRev = sumRevenue(current);
      const prevRev = sumRevenue(previous);
      const diff = curRev - prevRev;
      const pct = prevRev > 0 ? Math.round((diff / prevRev) * 100) : 0;
      return {
        count: countCompleted(current),
        revenue: curRev,
        diff,
        diffPct: pct,
        direction: diff >= 0 ? 'up' : 'down',
      };
    };

    // Просроченные: заказы со статусом ACCEPTED_BY_MERCHANT (приняты, но не отправлены)
    // и созданы более 24 часов назад
    const overdueThreshold = now - 24 * 60 * 60 * 1000;
    const overdue = allOrders
      .filter(
        o =>
          o.attributes.status === 'ACCEPTED_BY_MERCHANT' &&
          o.attributes.creationDate < overdueThreshold
      )
      .map(o => ({
        code: o.attributes.code,
        sum: o.attributes.totalPrice,
        date: o.attributes.creationDate,
        daysOverdue: Math.floor((now - o.attributes.creationDate) / (24 * 60 * 60 * 1000)),
      }))
      .sort((a, b) => b.daysOverdue - a.daysOverdue);

    // Возвраты
    const returns = allOrders
      .filter(o => o.attributes.status === 'RETURNED')
      .map(o => ({
        code: o.attributes.code,
        sum: o.attributes.totalPrice,
        date: o.attributes.creationDate,
      }))
      .sort((a, b) => b.date - a.date);

    // График: выручка по дням текущей и прошлой недели
    const chart = {
      current: groupByWeekday(weekOrders),
      previous: groupByWeekday(prevWeekOrders),
    };

    return NextResponse.json({
      updatedAt: now,
      sales: {
        today: buildMetric(todayOrders, yesterdayOrders),
        week: buildMetric(weekOrders, prevWeekOrders),
        month: buildMetric(monthOrders, prevMonthOrders),
      },
      chart,
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
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
