// =============================================================
//  POST /api/order-status
//  Сменить статус заказа в Kaspi.
//  Тело: { orderId, code, status }
//  Возможные статусы:
//   - ACCEPTED_BY_MERCHANT — принять заказ
//   - ASSEMBLED — заказ собран
//   - PACKAGE_REGISTERED — посылка зарегистрирована
//   - HANDED_OVER_TO_COURIER — передан курьеру
//   - DELIVERED — доставлен
//   - COMPLETED — выдан клиенту
//   - CANCELLED — отменён
// =============================================================
import { getUser, kaspiFetch } from './_lib/shared.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });

  const { orderId, code, status } = req.body || {};
  if (!orderId || !code || !status) {
    return res.status(400).json({ error: 'orderId, code и status обязательны' });
  }

  const result = await kaspiFetch('/orders', {
    method: 'POST',
    body: {
      data: {
        type: 'orders',
        id: orderId,
        attributes: {
          code,
          status,
        },
      },
    },
    timeoutMs: 8000,
  });

  if (!result.ok) {
    return res.status(result.status || 502).json({
      error: result.error || `Kaspi вернул ${result.status}`,
      details: result.data,
    });
  }

  return res.status(200).json({ ok: true, data: result.data });
}
