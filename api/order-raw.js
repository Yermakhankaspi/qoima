/**
 * GET /api/order-raw?orderId=XXX
 *
 * Возвращает все сырые данные заказа из Kaspi (для отладки и понимания структуры).
 */

import { kaspiFetch } from './_lib/kaspi.js';
import { requireAuth } from './_lib/session.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  try {
    const orderId = req.query.orderId;
    if (!orderId) {
      return res.status(400).json({ error: 'Не указан orderId' });
    }

    // Запрашиваем заказ напрямую
    const result = await kaspiFetch(`/orders/${encodeURIComponent(orderId)}`);
    res.status(200).json(result);
  } catch (err) {
    res.status(err.status || 500).json({
      error: err.message,
      details: err.kaspiResponse,
    });
  }
}
