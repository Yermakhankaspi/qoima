const { getUser, fetchOrdersChunked } = require("./_lib/shared");

const STATE_BY_TAB = {
  new: "NEW",
  sign: "SIGN_REQUIRED",
  pickup: "PICKUP",
  delivery: "DELIVERY",
  archive: "ARCHIVE",
  preorder: "KASPI_DELIVERY",
  packing: "KASPI_DELIVERY",
  transfer: "KASPI_DELIVERY",
  transmitted: "KASPI_DELIVERY",
  deliveryCancelled: "KASPI_DELIVERY",
};

function attr(order, key) {
  return order?.attributes?.[key] ?? order?.[key];
}

function status(order) {
  return String(attr(order, "status") || "").toUpperCase();
}

function filterByTab(orders, tab) {
  const cancelled = new Set(["CANCELLED", "CANCELED", "CANCELLING", "RETURNED", "KASPI_DELIVERY_RETURN_REQUESTED"]);

  if (tab === "preorder") {
    return orders.filter((o) => attr(o, "preOrder") === true);
  }

  if (tab === "deliveryCancelled") {
    return orders.filter((o) => cancelled.has(status(o)) || attr(o, "returnedToWarehouse") === true);
  }

  if (tab === "transmitted") {
    return orders.filter((o) => !cancelled.has(status(o)) && Boolean(attr(o, "courierTransmissionDate")));
  }

  if (tab === "transfer") {
    return orders.filter((o) => {
      if (cancelled.has(status(o)) || attr(o, "preOrder") === true) return false;
      return Boolean(attr(o, "courierTransmissionPlanningDate")) && !attr(o, "courierTransmissionDate");
    });
  }

  if (tab === "packing") {
    return orders.filter((o) => {
      if (cancelled.has(status(o)) || attr(o, "preOrder") === true) return false;
      return !attr(o, "courierTransmissionDate") && !attr(o, "courierTransmissionPlanningDate");
    });
  }

  return orders;
}

module.exports = async function handler(req, res) {
  const user = await getUser(req);
  if (!user) return res.status(401).json({ error: "Требуется вход" });
  if (!process.env.KASPI_API_TOKEN) return res.status(500).json({ error: "KASPI_API_TOKEN не настроен" });

  const tab = String(req.query.tab || "new");
  const days = Math.min(Math.max(parseInt(req.query.days || "30", 10), 1), 90);
  const state = req.query.state || STATE_BY_TAB[tab] || "NEW";

  const now = Date.now();
  const from = now - days * 86_400_000;

  const baseParams = { "filter[orders][state]": state };

  const result = await fetchOrdersChunked(baseParams, from, now, {
    chunkDays: 7,
    pageLimit: req.query.countOnly ? 3 : 5,
    pageSize: 100,
  });

  const filtered = filterByTab(result.orders, tab);

  if (req.query.countOnly) {
    return res.status(200).json({ count: filtered.length, error: result.error || null });
  }

  return res.status(200).json({ data: filtered, count: filtered.length, error: result.error || null });
};
