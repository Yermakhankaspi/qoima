/**
 * api/_lib/kaspi.js
 *
 * Обёртка для Kaspi Merchant API.
 * Папка начинается с _ — Vercel игнорирует её для роутинга,
 * но из других /api/*.js файлов можно импортировать.
 */

const KASPI_API = 'https://kaspi.kz/shop/api/v2';
const MAX_DAYS_PER_QUERY = 14;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Базовый запрос к Kaspi.
 */
export async function kaspiFetch(path, options = {}) {
  const token = process.env.KASPI_API_TOKEN;
  if (!token) {
    throw new Error('KASPI_API_TOKEN не задан в переменных окружения Vercel');
  }

  const res = await fetch(`${KASPI_API}${path}`, {
    ...options,
    headers: {
      'X-Auth-Token': token,
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    let parsed = text;
    try { parsed = JSON.parse(text); } catch {}
    const err = new Error(`Kaspi API ${res.status}: ${typeof parsed === 'string' ? parsed.slice(0, 200) : JSON.stringify(parsed).slice(0, 300)}`);
    err.status = res.status;
    err.kaspiResponse = parsed;
    throw err;
  }

  return res.json();
}

/**
 * Получить заказы за период макс 14 дней — с пагинацией.
 * Можно фильтровать по state.
 */
async function getOrdersOneWindow(fromMs, toMs, state) {
  const all = [];
  let page = 0;
  const pageSize = 100;

  while (true) {
    const params = new URLSearchParams({
      'page[number]': String(page),
      'page[size]': String(pageSize),
      'filter[orders][creationDate][$ge]': String(fromMs),
      'filter[orders][creationDate][$le]': String(toMs),
    });
    if (state) params.set('filter[orders][state]', state);

    const res = await kaspiFetch(`/orders?${params.toString()}`);
    all.push(...res.data);

    if (res.data.length < pageSize) break;
    page += 1;
    if (page > 30) break;
  }

  return all;
}

/**
 * Получить заказы за любой период — автоматически разбивает на 14-дневные куски.
 */
export async function getOrders(fromMs, toMs, state = null) {
  const chunks = [];
  let start = fromMs;
  while (start < toMs) {
    const end = Math.min(start + 13 * MS_PER_DAY, toMs);
    chunks.push([start, end]);
    start = end + 1;
  }

  const results = await Promise.all(
    chunks.map(([from, to]) =>
      getOrdersOneWindow(from, to, state).catch(err => {
        console.error(`Chunk ${new Date(from).toISOString()}-${new Date(to).toISOString()} failed:`, err.message);
        return [];
      })
    )
  );

  // Дедупликация
  const seen = new Set();
  const all = [];
  for (const list of results) {
    for (const o of list) {
      if (!seen.has(o.id)) {
        seen.add(o.id);
        all.push(o);
      }
    }
  }
  return all;
}

/**
 * Изменить статус заказа.
 */
export async function updateOrderStatus(orderId, code, newStatus) {
  return kaspiFetch(`/orders/${orderId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'orders',
        id: orderId,
        attributes: {
          code,
          status: newStatus,
        },
      },
    }),
  });
}

/**
 * Получить позиции заказа.
 */
export async function getOrderEntries(orderId) {
  return kaspiFetch(`/orders/${orderId}/entries`);
}

// ============ Утилиты по датам ============

export function startOfDay(d = new Date()) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function startOfWeek(d = new Date()) {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = пн
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

export function startOfMonth(d = new Date()) {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

// ============ Аналитические функции ============

/**
 * Сумма выручки по выданным заказам.
 */
export function sumRevenue(orders) {
  return orders
    .filter(o => o.attributes.status === 'COMPLETED')
    .reduce((s, o) => s + (o.attributes.totalPrice || 0), 0);
}

/**
 * Группировка выручки по дням недели (0=пн, 6=вс).
 */
export function groupByWeekday(orders) {
  const days = [0, 0, 0, 0, 0, 0, 0];
  for (const o of orders) {
    if (o.attributes.status !== 'COMPLETED') continue;
    const d = new Date(o.attributes.creationDate);
    const idx = (d.getDay() + 6) % 7;
    days[idx] += o.attributes.totalPrice || 0;
  }
  return days;
}
