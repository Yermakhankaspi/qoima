
const { getUser, fetchOrdersChunked } = require('./_lib/shared');

const ACTIVE_STATUSES = ['APPROVED_BY_BANK','ACCEPTED_BY_MERCHANT','ASSEMBLE','ARRIVED'];
const CANCEL_STATUSES = ['CANCELLED','CANCELLING','KASPI_DELIVERY_RETURN_REQUESTED','RETURNED','ARRIVED_BACKWARD'];
function a(o){ return o.attributes || {}; }
function status(o){ return String(a(o).status || '').toUpperCase(); }
function state(o){ return String(a(o).state || '').toUpperCase(); }
function isCancelled(o){ return CANCEL_STATUSES.includes(status(o)) || a(o).returnedToWarehouse === true; }
function isPreOrder(o){ return a(o).preOrder === true && !isCancelled(o) && !['ASSEMBLE','ARRIVED'].includes(status(o)); }
function isTransfer(o){ return !isCancelled(o) && status(o)==='ASSEMBLE'; }
function isTransmitted(o){ return !isCancelled(o) && (status(o)==='ARRIVED' || !!a(o).courierTransmissionDate); }
function isPacking(o){ return !isCancelled(o) && !isPreOrder(o) && !isTransfer(o) && !isTransmitted(o) && ['ACCEPTED_BY_MERCHANT','APPROVED_BY_BANK'].includes(status(o)); }
function classify(o){
  if(isCancelled(o)) return 'deliveryCancelled';
  if(isPreOrder(o)) return 'preorder';
  if(isTransfer(o)) return 'transfer';
  if(isTransmitted(o)) return 'transmitted';
  if(isPacking(o)) return 'packing';
  return 'other';
}
function normalize(o){
  const x=a(o);
  const c=x.customer || {};
  return {
    id:o.id,
    code:x.code || o.id,
    buyer:[c.firstName,c.lastName].filter(Boolean).join(' ') || x.customerName || '—',
    date:x.creationDate || 0,
    amount:x.totalPrice || 0,
    state:x.state || '',
    status:x.status || '',
    delivery:x.deliveryMode || x.deliveryType || '',
    city:x.deliveryAddress?.city || x.customer?.city || '',
    preOrder:!!x.preOrder,
    reservationDate:x.reservationDate || null,
    plannedDeliveryDate:x.plannedDeliveryDate || null,
    courierTransmissionPlanningDate:x.courierTransmissionPlanningDate || null,
    courierTransmissionDate:x.courierTransmissionDate || null,
    returnedToWarehouse:!!x.returnedToWarehouse,
    category:classify(o),
    raw:o
  };
}
async function loadAll(days){
  const now=Date.now(); const from=now-days*86400000;
  const filters=[
    {state:'NEW'}, {state:'SIGN_REQUIRED'}, {state:'PICKUP'}, {state:'DELIVERY'}, {state:'KASPI_DELIVERY'}, {state:'ARCHIVE'}
  ];
  const results=await Promise.all(filters.map(f=>fetchOrdersChunked({...f,fromMs:from,toMs:now})));
  const byId=new Map(); let error=null;
  for(const r of results){ if(r.error && !error) error=r.error; for(const o of r.orders) byId.set(o.id,o); }
  return {orders:[...byId.values()].map(normalize), error};
}
module.exports = async function handler(req,res){
  const user = await getUser(req);
  if(!user) return res.status(401).json({error:'Требуется вход'});
  if(!process.env.KASPI_API_TOKEN) return res.status(500).json({error:'KASPI_API_TOKEN не настроен'});
  const days=Math.max(7, Math.min(parseInt(req.query.days||'30',10) || 30, 365));
  const tab=String(req.query.tab||'all');
  try{
    const {orders,error}=await loadAll(days);
    const counts={new:0,delivery:0,sign:0,pickup:0,archive:0,preorder:0,packing:0,transfer:0,transmitted:0,deliveryCancelled:0,all:orders.length};
    for(const o of orders){
      if(o.state==='NEW' && ACTIVE_STATUSES.includes(o.status)) counts.new++;
      if(o.state==='DELIVERY' && ACTIVE_STATUSES.includes(o.status)) counts.delivery++;
      if(o.state==='SIGN_REQUIRED') counts.sign++;
      if(o.state==='PICKUP' && !CANCEL_STATUSES.includes(o.status)) counts.pickup++;
      if(o.state==='ARCHIVE') counts.archive++;
      if(o.state==='KASPI_DELIVERY') counts[o.category]=(counts[o.category]||0)+1;
      if(o.state!=='KASPI_DELIVERY' && CANCEL_STATUSES.includes(o.status)) counts.deliveryCancelled++;
    }
    let data=orders;
    if(tab==='new') data=orders.filter(o=>o.state==='NEW' && ACTIVE_STATUSES.includes(o.status));
    else if(tab==='delivery') data=orders.filter(o=>o.state==='DELIVERY' && ACTIVE_STATUSES.includes(o.status));
    else if(tab==='sign') data=orders.filter(o=>o.state==='SIGN_REQUIRED');
    else if(tab==='pickup') data=orders.filter(o=>o.state==='PICKUP' && !CANCEL_STATUSES.includes(o.status));
    else if(tab==='archive') data=orders.filter(o=>o.state==='ARCHIVE');
    else if(['preorder','packing','transfer','transmitted','deliveryCancelled'].includes(tab)) data=orders.filter(o=>o.state==='KASPI_DELIVERY' && o.category===tab);
    return res.status(200).json({data,counts,error,debug:orders.map(o=>({code:o.code,state:o.state,status:o.status,category:o.category,preOrder:o.preOrder,planned:o.courierTransmissionPlanningDate,transmitted:o.courierTransmissionDate,returned:o.returnedToWarehouse})).slice(0,30)});
  }catch(e){ return res.status(500).json({error:e.message}); }
};
