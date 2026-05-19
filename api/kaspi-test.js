/**
 * GET /api/kaspi-test
 *
 * Проверяет связь с Kaspi API.
 */

import { kaspiFetch } from './_lib/kaspi.js';
import { requireAuth } from './_lib/session.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  try {
    // Минимальный запрос — последние заказы
    const result = await kaspiFetch('/orders?page[number]=0&page[size]=1');
    res.status(200).json({
      ok: true,
      message: 'Связь с Kaspi работает',
      sample: {
        totalReturned: result.data?.length || 0,
      },
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}
