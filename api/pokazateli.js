/**
 * api/pokazateli.js
 *
 * Vercel Serverless Function.
 * Endpoint: GET /api/pokazateli
 *
 * Тянет заказы из Kaspi Merchant API и агрегирует:
 *   - продажи сегодня / неделя / месяц + сравнение с прошлым периодом
 *   - график по дням текущей и прошлой недели
 *   - просроченные заказы и возвраты
 *
 * Токен берётся из переменной окружения KASPI_API_TOKEN (уже настроена у вас в Vercel).
 */

const KASPI_API = 'https://kaspi.kz/shop/api/v2';

async function kaspiFetch(path) {
  const token = process.env.KASPI_API_TOKEN;
  if (!token) throw new Error('KASPI_API_TOKEN не задан в переменных окружения Vercel');

  const res = await fetch(`${KASPI_API}${path}`, {
    headers: {
      'X-Auth-Token': token,
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kaspi API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

async function getOrders(fromMs, toMs) {
  const all = [];
  let page = 0;
  const pageSize = 100;

  while (true) {
    const query = new URLSearchParams({
      'page[number]': String(page),
      'page[size]': String(pageSize),
      'filter[orders][creationDate][$ge]': String(fromMs),
      'filter[orders][creationDate][$le]': String(toMs),
    });

    const res = await kaspiFetch(`/orders?${query.toString()}`);
    all.push(...res.data);

    if (res.data.length < pageSize) break;
    page += 1;
    if (page > 50) break; // защита
  }

  return all;
}

function sumRevenue(orders) {
  return orders
    .filter(o => o.attributes.status === 'COMPLETED')
    .reduce((s, o) => s + (o.attributes.totalPrice || 0), 0);
}

function groupByWeekday(orders) {
  const days = [0, 0, 0, 0, 0, 0, 0];
  for (const o of orders) {
    if (o.attributes.status !== 'COMPLETED') continue;
    const d = new Date(o.attributes.creationDate);
    const idx = (d.getDay() + 6) % 7; // 0 = пн
    days[idx] += o.attributes.totalPrice || 0;
  }
  return days;
}

function startOfDay(d = new Date()) {
  const x = new Date(d); x.setHours(0, 0, 0, 0); return x.getTime();
}
function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7;
  x.setDate(x.getDate() - day); x.setHours(0, 0, 0, 0); return x.getTime();
}
function startOfMonth(d = new Date()) {
  const x = new Date(d); x.setDate(1); x.setHours(0, 0, 0, 0); return x.getTime();
}

export default async function handler(req, res) {
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

    const sixtyDaysAgo = now - 60 * 24 * 60 * 60 * 1000;
    const allOrders = await getOrders(sixtyDaysAgo, now);

    const filterByRange = (from, to) =>
      allOrders.filter(o => o.attributes.creationDate >= from && o.attributes.creationDate < to);

    const todayOrders = filterByRange(todayStart, now);
    const yesterdayOrders = filterByRange(yesterdayStart, todayStart);
    const weekOrders = filterByRange(weekStart, now);
    const prevWeekOrders = filterByRange(prevWeekStart, weekStart);
    const monthOrders = filterByRange(monthStart, now);
    const prevMonthOrders = filterByRange(prevMonthStart, monthStart);

    const countCompleted = (arr) => arr.filter(o => o.attributes.status === 'COMPLETED').length;

    const buildMetric = (current, previous) => {
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

    const overdueThreshold = now - 24 * 60 * 60 * 1000;
    const overdue = allOrders
      .filter(o =>
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

    const returns = allOrders
      .filter(o => o.attributes.status === 'RETURNED')
      .map(o => ({
        code: o.attributes.code,
        sum: o.attributes.totalPrice,
        date: o.attributes.creationDate,
      }))
      .sort((a, b) => b.date - a.date);

    res.status(200).json({
      updatedAt: now,
      sales: {
        today: buildMetric(todayOrders, yesterdayOrders),
        week: buildMetric(weekOrders, prevWeekOrders),
        month: buildMetric(monthOrders, prevMonthOrders),
      },
      chart: {
        current: groupByWeekday(weekOrders),
        previous: groupByWeekday(prevWeekOrders),
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
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unknown error' });
  }
}
