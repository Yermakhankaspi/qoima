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
 * Изменить статус заказа (или другие поля типа `assembled`).
 *
 * Для перевода в "Передачу" (готов к курьеру) — нужно отправить assembled=true.
 * Для смены статуса — поле status.
 */
export async function updateOrderStatus(orderId, code, newStatus) {
  // Специальная команда — пометить как собранный
  // (в Kaspi кабинете это кнопка "Собран")
  let attributes;
  if (newStatus === 'ASSEMBLE') {
    attributes = { code, assembled: true, status: 'ACCEPTED_BY_MERCHANT' };
  } else {
    attributes = { code, status: newStatus };
  }
  return kaspiFetch(`/orders/${orderId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      data: {
        type: 'orders',
        id: orderId,
        attributes,
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

// ============ Утилиты по датам (в часовом поясе Алматы, UTC+5) ============
//
// На сервере Vercel время в UTC. У пользователя в Казахстане UTC+5.
// Если использовать обычный setHours(0,0,0,0), сервер посчитает "начало дня" по UTC,
// а это не совпадет с тем что пользователь видит в Kaspi.
// Поэтому смещаем все вычисления на +5 часов.

const TZ_OFFSET_MS = 5 * 60 * 60 * 1000; // UTC+5 для Алматы / Астаны

/**
 * Начало дня по Алматы — возвращает timestamp в UTC.
 */
export function startOfDay(d = new Date()) {
  const ms = d.getTime();
  // Смещаем в "виртуальное UTC", где время как в Алматы
  const localMs = ms + TZ_OFFSET_MS;
  // Округляем до начала дня
  const dayStart = Math.floor(localMs / MS_PER_DAY) * MS_PER_DAY;
  // Возвращаем обратно в реальный UTC
  return dayStart - TZ_OFFSET_MS;
}

/**
 * Начало недели (понедельник) по Алматы.
 */
export function startOfWeek(d = new Date()) {
  const dayStart = startOfDay(d);
  // Получаем день недели по Алматы
  const localDate = new Date(dayStart + TZ_OFFSET_MS);
  const dayOfWeek = (localDate.getUTCDay() + 6) % 7; // 0 = пн
  return dayStart - dayOfWeek * MS_PER_DAY;
}

/**
 * Начало месяца по Алматы (1-е число 00:00).
 */
export function startOfMonth(d = new Date()) {
  const ms = d.getTime();
  const localMs = ms + TZ_OFFSET_MS;
  const localDate = new Date(localMs);
  localDate.setUTCDate(1);
  localDate.setUTCHours(0, 0, 0, 0);
  return localDate.getTime() - TZ_OFFSET_MS;
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
 * Группировка выручки по дням недели (0=пн, 6=вс) — по часовому поясу Алматы.
 */
export function groupByWeekday(orders) {
  const days = [0, 0, 0, 0, 0, 0, 0];
  for (const o of orders) {
    if (o.attributes.status !== 'COMPLETED') continue;
    // Конвертируем дату заказа в Алматы (UTC+5) для правильного дня недели
    const almatyTs = o.attributes.creationDate + TZ_OFFSET_MS;
    const d = new Date(almatyTs);
    const idx = (d.getUTCDay() + 6) % 7; // 0 = пн
    days[idx] += o.attributes.totalPrice || 0;
  }
  return days;
}
