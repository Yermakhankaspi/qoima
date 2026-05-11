const { getUser, fetchOrdersByStateChunked } = require('./_lib/shared');

const STATES_TO_LOAD = ['NEW', 'SIGN_REQUIRED', 'PICKUP', 'DELIVERY', 'KASPI_DELIVERY', 'ARCHIVE'];
const FINAL_STATUSES = new Set(['COMPLETED', 'CANCELLED', 'CANCELLING', 'RETURNED', 'KASPI_DELIVERY_RETURN_REQUESTED', 'ARRIVED_BACKWARD']);
const CANCEL_STATUSES = new Set(['CANCELLED', 'CANCELLING', 'RETURNED', 'KASPI_DELIVERY_RETURN_REQUESTED', 'ARRIVED_BACKWARD']);

function upper(value) { return String(value || '').toUpperCase(); }
function attrs(order) { return order?.attributes || order || {}; }
function has(value) { return value !== undefined && value !== null && value !== '' && value !== false; }

function isKaspiDelivery(order) {
  const a = attrs(order);
  const state = upper(a.state);
  const deliveryType = upper(a.deliveryType || a.deliveryMode || a.delivery || a.deliveryMethod);
  return state === 'KASPI_DELIVERY' || deliveryType.includes('KASPI');
}

function isPreOrderFlag(order) {
  const a = attrs(order);
  return a.preOrder === true || a.preorder === true || a.isPreOrder === true || upper(a.preOrder) === 'TRUE';
}

function isCancelledDelivery(order) {
  const a = attrs(order);
  const status = upper(a.status);
  return CANCEL_STATUSES.has(status) || a.returnedToWarehouse === true || a.cancelled === true;
}

function hasTransferDocument(order) {
  const a = attrs(order);
  return has(a.waybill) || has(a.waybillNumber) || has(a.waybillUrl) || has(a.assemblyDate) || has(a.numberOfSpace);
}

function hasCourierTransmission(order) {
  const a = attrs(order);
  return has(a.courierTransmissionDate) || has(a.transmissionDate) || has(a.kaspiDeliveryDate) || has(a.actualDeliveryDate) || has(a.deliveryDate);
}

function classifyOrder(order) {
  const a = attrs(order);
  const state = upper(a.state);
  const status = upper(a.status);

  let bucket = 'archive';
  let reason = '';

  if (state === 'NEW') return mark(order, 'new', 'state=NEW');
  if (state === 'SIGN_REQUIRED') return mark(order, 'sign', 'state=SIGN_REQUIRED');
  if (state === 'PICKUP') return mark(order, 'pickup', 'state=PICKUP');
  if (state === 'DELIVERY') return mark(order, 'delivery', 'state=DELIVERY');

  if (isKaspiDelivery(order)) {
    if (isCancelledDelivery(order)) return mark(order, 'deliveryCancelled', `cancel status=${status || 'field'}`);

    if (status === 'ASSEMBLE' || status === 'ASSEMBLY' || status === 'TRANSFER' || hasTransferDocument(order)) {
      return mark(order, 'transfer', `transfer status/document=${status || 'waybill'}`);
    }

    if (status === 'ARRIVED' || status === 'ACCEPTED_BY_MERCHANT' || status === 'ON_DELIVERY' || status === 'DELIVERING' || status === 'SHIPPED' || hasCourierTransmission(order)) {
      return mark(order, 'transmitted', `transmitted status/date=${status || 'courierTransmissionDate'}`);
    }

    if (isPreOrderFlag(order) && !FINAL_STATUSES.has(status)) {
      return mark(order, 'preorder', `preOrder=true status=${status || '-'}`);
    }

    if (status === 'APPROVED_BY_BANK' || !FINAL_STATUSES.has(status)) {
      return mark(order, 'packing', `packing status=${status || '-'}`);
    }
  }

  if (state === 'ARCHIVE') return mark(order, 'archive', 'state=ARCHIVE');
  return mark(order, bucket, reason || `fallback state=${state} status=${status}`);
}

function mark(order, bucket, reason) {
  order.__bucket = bucket;
  order.__bucketReason = reason;
  return bucket;
}

function getAmount(order) {
  const a = attrs(order);
  return Number(a.totalPrice ?? a.amount ?? a.price ?? 0) || 0;
}

function getDate(order) {
  const a = attrs(order);
  return Number(a.creationDate || a.createdAt || a.date || 0) || 0;
}

function dedupe(orders) {
  const seen = new Set();
  return orders.filter((order) => {
    const id = order.id || attrs(order).code;
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
}

module.exports = async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: 'Требуется вход' });
  if (!process.env.KASPI_API_TOKEN) return res.status(500).json({ error: 'KASPI_API_TOKEN не настроен' });

  const tab = String(req.query.tab || 'transmitted');
  const days = Math.max(1, Math.min(parseInt(req.query.days || '30', 10), 120));
  const now = Date.now();
  const from = now - days * 86_400_000;

  try {
    const loaded = await Promise.all(STATES_TO_LOAD.map(async (state) => {
      const result = await fetchOrdersByStateChunked(state, from, now);
      return { state, ...result };
    }));

    let firstError = null;
    let all = [];
    for (const part of loaded) {
      all.push(...(part.orders || []));
      if (part.error && !firstError) firstError = `${part.state}: ${part.error}`;
    }

    all = dedupe(all);
    for (const order of all) classifyOrder(order);

    const counts = {
      new: 0,
      delivery: 0,
      sign: 0,
      pickup: 0,
      preorder: 0,
      packing: 0,
      transfer: 0,
      transmitted: 0,
      deliveryCancelled: 0,
      archive: 0,
    };

    for (const order of all) counts[order.__bucket] = (counts[order.__bucket] || 0) + 1;

    const data = all
      .filter((order) => order.__bucket === tab)
      .sort((a, b) => getDate(b) - getDate(a));

    const activeBuckets = ['new', 'delivery', 'sign', 'pickup', 'preorder', 'packing', 'transfer', 'transmitted', 'deliveryCancelled'];
    const activeOrders = all.filter((order) => activeBuckets.includes(order.__bucket));
    const dashboardSample = all.slice().sort((a, b) => getDate(b) - getDate(a)).slice(0, 8);

    return res.status(200).json({
      data,
      counts,
      dashboard: {
        total: activeOrders.length + counts.archive,
        revenue: all.reduce((sum, order) => sum + getAmount(order), 0),
        sample: dashboardSample,
      },
      error: firstError,
      rangeText: `Загружено из Kaspi API: ${all.length} заказов за ${days} дней. Вкладки считаются на сервере по state/status/preOrder.`
    });
  } catch (error) {
    return res.status(500).json({ error: 'Ошибка загрузки Kaspi: ' + error.message });
  }
};
