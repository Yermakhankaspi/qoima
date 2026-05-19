/**
 * lib/kaspi.ts
 *
 * Обёртка для запросов к Kaspi Merchant API.
 * Токен берётся из переменной окружения KASPI_API_TOKEN (Vercel → Settings → Environment Variables).
 *
 * Документация Kaspi API: https://kaspi.kz/merchantcabinet/api/v2/
 */

const KASPI_API = 'https://kaspi.kz/shop/api/v2';

export interface KaspiOrder {
  id: string;
  type: 'orders';
  attributes: {
    code: string;
    totalPrice: number;
    creationDate: number; // timestamp в мс
    deliveryCostForSeller: number;
    isKaspiDelivery: boolean;
    state: 'NEW' | 'SIGN_REQUIRED' | 'PICKUP' | 'DELIVERY' | 'KASPI_DELIVERY' | 'ARCHIVE';
    status: 'APPROVED_BY_BANK' | 'ACCEPTED_BY_MERCHANT' | 'COMPLETED' | 'CANCELLED' | 'CANCELLING' | 'RETURNED';
    paymentMode: string;
    plannedDeliveryDate?: number;
    customer?: {
      firstName: string;
      lastName: string;
      cellPhone: string;
    };
  };
}

interface KaspiResponse<T> {
  data: T[];
  meta?: { totalCount: number; pageCount: number };
}

/**
 * Базовый fetch к Kaspi API.
 */
async function kaspiFetch<T>(path: string): Promise<KaspiResponse<T>> {
  const token = process.env.KASPI_API_TOKEN;
  if (!token) throw new Error('KASPI_API_TOKEN не задан в переменных окружения');

  const res = await fetch(`${KASPI_API}${path}`, {
    headers: {
      'X-Auth-Token': token,
      'Accept': 'application/vnd.api+json',
      'Content-Type': 'application/vnd.api+json',
    },
    // Vercel кэширует fetch по умолчанию — для актуальных данных отключаем
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kaspi API ${res.status}: ${text.slice(0, 200)}`);
  }

  return res.json();
}

/**
 * Получить заказы за период.
 * Kaspi API ограничивает выдачу — забираем постранично.
 */
export async function getOrders(params: {
  fromMs: number;
  toMs: number;
  state?: KaspiOrder['attributes']['state'];
  status?: KaspiOrder['attributes']['status'];
}): Promise<KaspiOrder[]> {
  const all: KaspiOrder[] = [];
  let page = 0;
  const pageSize = 100;

  while (true) {
    const query = new URLSearchParams({
      'page[number]': String(page),
      'page[size]': String(pageSize),
      'filter[orders][creationDate][$ge]': String(params.fromMs),
      'filter[orders][creationDate][$le]': String(params.toMs),
    });
    if (params.state) query.set('filter[orders][state]', params.state);
    if (params.status) query.set('filter[orders][status]', params.status);

    const res = await kaspiFetch<KaspiOrder>(`/orders?${query.toString()}`);
    all.push(...res.data);

    if (res.data.length < pageSize) break;
    page += 1;
    if (page > 50) break; // защита от бесконечного цикла
  }

  return all;
}

/**
 * Сумма выручки по заказам (только выданные).
 */
export function sumRevenue(orders: KaspiOrder[]): number {
  return orders
    .filter(o => o.attributes.status === 'COMPLETED')
    .reduce((s, o) => s + (o.attributes.totalPrice || 0), 0);
}

/**
 * Группировка заказов по дням недели (0 = воскресенье, 6 = суббота).
 * Возвращает суммы выручки по дням пн-вс.
 */
export function groupByWeekday(orders: KaspiOrder[]): number[] {
  const days = [0, 0, 0, 0, 0, 0, 0]; // пн, вт, ср, чт, пт, сб, вс
  for (const o of orders) {
    if (o.attributes.status !== 'COMPLETED') continue;
    const d = new Date(o.attributes.creationDate);
    // Конвертируем JS getDay() (0=вс) в наш формат (0=пн)
    const idx = (d.getDay() + 6) % 7;
    days[idx] += o.attributes.totalPrice || 0;
  }
  return days;
}

/**
 * Граница «начало дня» в мс.
 */
export function startOfDay(d = new Date()): number {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * Граница «начало недели» (понедельник) в мс.
 */
export function startOfWeek(d = new Date()): number {
  const x = new Date(d);
  const day = (x.getDay() + 6) % 7; // 0 = пн
  x.setDate(x.getDate() - day);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

/**
 * Граница «начало месяца» в мс.
 */
export function startOfMonth(d = new Date()): number {
  const x = new Date(d);
  x.setDate(1);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}
