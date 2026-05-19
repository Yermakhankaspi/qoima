/**
 * GET /api/kaspi-test
 *
 * Проверяет связь с Kaspi API.
 * Kaspi требует обязательный фильтр по дате — запрашиваем заказы за последние 24 часа.
 */

import { kaspiFetch, MS_PER_DAY } from './_lib/kaspi.js';
import { requireAuth } from './_lib/session.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  try {
    const now = Date.now();
    const dayAgo = now - MS_PER_DAY;
    const result = await kaspiFetch(
      `/orders?filter[orders][creationDate][$ge]=${dayAgo}&filter[orders][creationDate][$le]=${now}&page[number]=0&page[size]=1`
    );
    res.status(200).json({
      ok: true,
      message: `Связь с Kaspi работает. За последние сутки заказов: ${result.meta?.totalCount ?? (result.data?.length || 0)}`,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}
