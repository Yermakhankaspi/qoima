/**
 * POST /api/order-status
 * Body: { orderId, code, status }
 *
 * Меняет статус заказа в Kaspi.
 */

import { updateOrderStatus } from './_lib/kaspi.js';
import { requireAuth } from './_lib/session.js';

export default async function handler(req, res) {
  if (!requireAuth(req, res)) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const { orderId, code, status } = body;
    if (!orderId || !code || !status) {
      return res.status(400).json({ error: 'Не хватает orderId, code или status' });
    }

    const result = await updateOrderStatus(orderId, code, status);
    res.status(200).json({ ok: true, result });
  } catch (err) {
    console.error('Order status error:', err);
    res.status(err.status || 500).json({
      error: err.message || 'Unknown error',
      details: err.kaspiResponse,
    });
  }
}
