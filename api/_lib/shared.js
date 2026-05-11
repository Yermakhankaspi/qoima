
const { Redis } = require('@upstash/redis');

function getRedis(){
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if(!url || !token) return null;
  return new Redis({ url, token });
}
function parseCookies(str){
  return (str||'').split(';').reduce((a,c)=>{const [k,...r]=c.trim().split('='); if(k) a[k]=decodeURIComponent(r.join('=')||''); return a;},{});
}
async function getUser(req){
  const redis=getRedis(); if(!redis) return null;
  const s=parseCookies(req.headers.cookie).session; if(!s) return null;
  try{ const userId=await redis.get(`session:${s}`); if(!userId) return null; return await redis.get(`user:${userId}`); }catch(e){ return null; }
}
async function kaspiFetch(path, opts={}){
  const token=process.env.KASPI_API_TOKEN; if(!token) throw new Error('KASPI_API_TOKEN не настроен');
  const url=path.startsWith('http')?path:`https://kaspi.kz/shop/api/v2${path}`;
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(), opts.timeoutMs||12000);
  try{
    const r=await fetch(url,{method:opts.method||'GET',headers:{Accept:'application/vnd.api+json','Content-Type':'application/vnd.api+json','X-Auth-Token':token,...(opts.headers||{})},body:opts.body?JSON.stringify(opts.body):undefined,signal:controller.signal});
    clearTimeout(timer); const text=await r.text(); let data; try{data=JSON.parse(text)}catch{data={raw:text}};
    return {ok:r.ok,status:r.status,data};
  }catch(e){ clearTimeout(timer); return {ok:false,status:0,error:e.name==='AbortError'?'timeout':e.message}; }
}
async function fetchOrders({state, status, deliveryType, signatureRequired, fromMs, toMs, page=0, size=100}){
  const p=new URLSearchParams();
  p.set('page[number]', String(page)); p.set('page[size]', String(size));
  if(state) p.set('filter[orders][state]', state);
  if(status) p.set('filter[orders][status]', status);
  if(deliveryType) p.set('filter[orders][deliveryType]', deliveryType);
  if(typeof signatureRequired==='boolean') p.set('filter[orders][signatureRequired]', String(signatureRequired));
  p.set('filter[orders][creationDate][$ge]', String(fromMs)); p.set('filter[orders][creationDate][$le]', String(toMs));
  p.set('include[orders]', 'user');
  const r=await kaspiFetch('/orders?'+p.toString());
  if(!r.ok) return {orders:[],error:r.error||`HTTP ${r.status}`,meta:null};
  return {orders:r.data.data||[],included:r.data.included||[],meta:r.data.meta||null,error:null};
}
async function fetchOrdersChunked(filter){
  const WEEK=7*86400000; const fromMs=filter.fromMs, toMs=filter.toMs; const chunks=[];
  for(let t=fromMs;t<toMs;t+=WEEK) chunks.push([t,Math.min(t+WEEK-1,toMs)]);
  const results=await Promise.all(chunks.map(async([a,b])=>{
    const all=[]; let firstError=null;
    for(let page=0;page<10;page++){
      const r=await fetchOrders({...filter,fromMs:a,toMs:b,page,size:100});
      if(r.error){firstError=r.error;break}
      all.push(...r.orders);
      const pageCount=r.meta && Number(r.meta.pageCount||0);
      if(r.orders.length<100 || (pageCount && page>=pageCount-1)) break;
    }
    return {orders:all,error:firstError};
  }));
  const map=new Map(); let firstError=null;
  for(const r of results){ if(r.error && !firstError) firstError=r.error; for(const o of r.orders) map.set(o.id,o); }
  const arr=[...map.values()].sort((a,b)=>(b.attributes?.creationDate||0)-(a.attributes?.creationDate||0));
  return {orders:arr,error:firstError};
}
module.exports={getRedis,parseCookies,getUser,kaspiFetch,fetchOrders,fetchOrdersChunked};
