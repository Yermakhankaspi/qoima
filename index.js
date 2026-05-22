import { useState, useEffect, useRef } from 'react';
import Head from 'next/head';

const PRODUCTS = [
  {id:'241235696',name:'Простой штатив CS-PH1111 черный',stock:2146,buy:850,sell:1290},
  {id:'115932179',name:'Лампочка 15ват',stock:892,buy:230,sell:380},
  {id:'133227473',name:'Лампочка 50ват',stock:303,buy:900,sell:1400},
  {id:'999524182',name:'Лампа М-26',stock:165,buy:1000,sell:1600},
  {id:'970316907',name:'ЗН Acer CS-Ac007 LP514 19V 4.74A',stock:38,buy:1634,sell:2600},
  {id:'616239656',name:'ЗН Acer CS-A11 19V 3.42A 5.5x1.7мм',stock:107,buy:1559,sell:2400},
  {id:'218235477',name:'ЗН Acer CS-Ac342T 19V 3.42A 3.0x1.1мм',stock:98,buy:1559,sell:2400},
  {id:'125677517',name:'SIL-ORA AirPods Pro 3 оранжевый',stock:51,buy:112,sell:200},
  {id:'412197805',name:'ЗН HP CS-H462 19.5V 4.62A',stock:235,buy:1625,sell:2500},
  {id:'130623147',name:'SIL AirPods 4 прозрачный',stock:150,buy:200,sell:350},
  {id:'360562448',name:'ЗН Lenovo 90W 20V 4.5A 5.5x2.5',stock:91,buy:1625,sell:2500},
  {id:'312533905',name:'ЗН Asus 65W 19V 3.42A 4.0x1.35мм',stock:45,buy:2112,sell:3300},
  {id:'852664139',name:'CLASSNO RGB CS-P225',stock:36,buy:7000,sell:11000},
  {id:'283359932',name:'Стекло 6/7mini',stock:61,buy:300,sell:500},
  {id:'794045108',name:'ЗН Lenovo 20V 3.25A 65W 5.5x2.5мм',stock:0,buy:2070,sell:3200},
  {id:'825437522',name:'Чехол планшет RM A16 серый',stock:428,buy:1533,sell:2400},
  {id:'964634472',name:'Чехол планшет RM A16 розовый',stock:294,buy:1533,sell:2400},
  {id:'809308290',name:'SIL-PN AirPods Pro 3 розовый',stock:77,buy:112,sell:200},
  {id:'746726184',name:'SIL-PN AirPods 4 розовый',stock:316,buy:112,sell:200},
  {id:'391634656',name:'Sil-BLU AirPods Pro 3 синий',stock:53,buy:112,sell:200},
  {id:'097307597',name:'SIL-BLK AirPods Pro 3 черный',stock:71,buy:112,sell:200},
  {id:'752456156',name:'Пленка Macbook Air 15.3',stock:27,buy:540,sell:900},
  {id:'819961035',name:'Пленка 13.6 Macbook Air',stock:54,buy:540,sell:900},
  {id:'726840510',name:'Пленка Air 13.3',stock:87,buy:540,sell:900},
  {id:'253920733',name:'Чехол iPad KB-LC Air 11 сиреневый',stock:103,buy:3234,sell:5000},
  {id:'925013454',name:'Чехол KB-PN iPad A16 розовый',stock:330,buy:3227,sell:5000},
  {id:'323079735',name:'Чехол iPad KB-LC A16 сиреневый',stock:214,buy:3227,sell:5000},
  {id:'605751597',name:'Чехол KB-BLK A16 черный',stock:188,buy:3227,sell:5000},
  {id:'579327925',name:'ЗН TYPE-C 5-20V 3.25A 65W',stock:34,buy:2037,sell:3200},
  {id:'100237006',name:'Чехол iPad KB-LBL A16 голубой',stock:152,buy:3227,sell:5000},
  {id:'999524184',name:'Лампа RL-14',stock:122,buy:6300,sell:9500},
  {id:'999524185',name:'Лампа RL-18',stock:69,buy:10100,sell:15000},
  {id:'855166409',name:'AirPods Pro 3 прозрачный',stock:101,buy:150,sell:280},
  {id:'915504413',name:'ЗН Зарядка Lenovo USB 4.5A 90W',stock:64,buy:1709,sell:2700},
  {id:'432677485',name:'ЗН HP CS-H333 19.5V 3.33A',stock:33,buy:1596,sell:2500},
  {id:'933267842',name:'CLASSNO LED CS-YM200',stock:1,buy:4500,sell:7000},
  {id:'999524183',name:'Лампа Y-320',stock:57,buy:3650,sell:5500},
  {id:'190678397',name:'ЗН Asus 65W 19V 3.42A 5.5x2.5 с шнуром',stock:15,buy:2000,sell:3100},
  {id:'697614677',name:'Стекло основной Air 11',stock:46,buy:300,sell:500},
  {id:'097304164',name:'Стилус CLASSNO CS-ST01 Universal Pen белый',stock:25,buy:1500,sell:2400},
  {id:'999524186',name:'Лампа RL-21',stock:70,buy:11500,sell:17000},
  {id:'759166964',name:'Чехол планшет ZP A16 серый',stock:143,buy:1158,sell:1800},
  {id:'068375300',name:'Чехол планшет ZP A16 сиреневый',stock:179,buy:1158,sell:1800},
  {id:'903732615',name:'Чехол планшет ZP Air 11 серый',stock:65,buy:1158,sell:1800},
  {id:'706062061',name:'Чехол планшет RM A16 сиреневый',stock:159,buy:1533,sell:2400},
  {id:'729259232',name:'Чехол планшет RM Air 11 серый',stock:287,buy:533,sell:900},
  {id:'537686262',name:'Чехол планшет RM Air 11 сиреневый',stock:99,buy:1533,sell:2400},
  {id:'799445664',name:'Чехол CLASSNO RM-LBL Air 11 голубой',stock:77,buy:1533,sell:2400},
  {id:'999524178',name:'Лампа MJ-26',stock:90,buy:1404,sell:2200},
  {id:'999524179',name:'Лампа MJ-33',stock:81,buy:1854,sell:2900},
  {id:'999524187',name:'Лампа PL-26',stock:183,buy:1629,sell:2500},
  {id:'505892731',name:'RNG AirPods 4 черный',stock:19,buy:658,sell:1100},
  {id:'709333950',name:'RNG AirPods 4 черный красный',stock:23,buy:658,sell:1100},
  {id:'359500987',name:'RNG AirPods Pro 3 черный',stock:22,buy:658,sell:1100},
  {id:'759800715',name:'ЗН 3.25 4.0x1.7 Lenovo orginal',stock:181,buy:2550,sell:3900},
  {id:'209410329',name:'Чехол iPad TP-PUR A16 фиолетовый',stock:18,buy:4509,sell:7000},
  {id:'232736564',name:'Чехол iPad TP-PN A16 розовый',stock:118,buy:4577,sell:7000},
  {id:'592704294',name:'Чехол iPad TP-BLK A16 черный',stock:82,buy:4577,sell:7000},
  {id:'174689577',name:'Чехол iPad TP-BLK Air 11 черный',stock:14,buy:4509,sell:7000},
  {id:'091931461',name:'CLASSNO CS-Fon 2x3м черный',stock:46,buy:2840,sell:4400},
  {id:'589144079',name:'CLASSNO CS-Fon 3x3м белый',stock:27,buy:3965,sell:6100},
  {id:'512488554',name:'CLASSNO CS-Fon 3x4м зеленый',stock:29,buy:5022,sell:7800},
  {id:'251595247',name:'Стекло SG iPad A16',stock:27,buy:1161,sell:1800},
  {id:'517453706',name:'CLASSNO CS-M01 розовый',stock:81,buy:800,sell:1400},
  {id:'288304610',name:'CLASSNO CS-M01 черный',stock:97,buy:800,sell:1400},
  {id:'505974677',name:'Apple Watch 40mm черный',stock:306,buy:185,sell:350},
  {id:'670375403',name:'Apple Watch 44мм черный',stock:306,buy:185,sell:350},
  {id:'025585363',name:'Apple Watch Series 46 мм черный',stock:229,buy:185,sell:350},
  {id:'473190122',name:'CS-01 Apple Watch 40мм прозрачный',stock:127,buy:185,sell:350},
  {id:'088487960',name:'CLASSNO CS-KIT розовый',stock:47,buy:1678,sell:2600},
  {id:'709426156',name:'CLASSNO CS-KIT голубой',stock:18,buy:1678,sell:2600},
  {id:'128295775',name:'CLASSNO CS-1080 Mag Ultra 10000мАч черный',stock:39,buy:3727,sell:5800},
  {id:'394275334',name:'CLASSNO ZL-Fon 2x3м зеленый',stock:78,buy:2772,sell:4300},
  {id:'075420061',name:'Основной Стойка П 2.6/3м',stock:26,buy:6165,sell:9500},
  {id:'944890555',name:'ЗН Зарядка Type-C 65Вт черный',stock:800,buy:1962,sell:3000},
  {id:'830949556',name:'ЗН Asus 45W 19V 2.37A 4.0x1.35',stock:78,buy:1963,sell:3000},
  {id:'373154061',name:'CLASSNO CS-BT01',stock:1790,buy:159,sell:300},
  {id:'999524190',name:'Шарик 180градус',stock:801,buy:130,sell:250},
  {id:'775926997',name:'Держатель CLASSNO CS-Der01 черный',stock:745,buy:97,sell:180},
  {id:'955860932',name:'CS-Сердичка AirPods Pro 2 розовый',stock:293,buy:249,sell:450},
  {id:'092353390',name:'CS-Сердичка AirPods 4 розовый',stock:483,buy:249,sell:450},
  {id:'746726184b',name:'SIL-PN AirPods 4 розовый (2)',stock:316,buy:112,sell:200},
  {id:'580209869',name:'SIL-BLU AirPods 4 синий',stock:219,buy:112,sell:200},
  {id:'219705076',name:'SIL-BLK AirPods 4 черный',stock:216,buy:112,sell:200},
  {id:'171645012',name:'ЗН Lenovo USB 20V 65W 3.25A Flat',stock:86,buy:1596,sell:2500},
  {id:'058275010',name:'Напольный штатив CS-HT2100 черный',stock:443,buy:2350,sell:3600},
  {id:'592196764',name:'Стекло А16',stock:418,buy:300,sell:500},
  {id:'966242039',name:'ЧМ Macbook Air 13.6 прозрачный',stock:427,buy:1127,sell:1800},
  {id:'165814428',name:'CS-Mag AirPods Pro 3 черный',stock:29,buy:660,sell:1100},
  {id:'952068361',name:'CS-Mag AirPods 4 черный',stock:35,buy:660,sell:1100},
  {id:'472923948',name:'CLASSNO Watch Dream белый',stock:70,buy:429,sell:700},
];

export default function Dashboard() {
  const [tab, setTab] = useState('показатели');
  const [skTab, setSkTab] = useState('opri');
  const [kaspi, setKaspi] = useState(null);
  const [kaspiLoading, setKaspiLoading] = useState(false);
  const [prodSearch, setProdSearch] = useState('');
  const [prodFilter, setProdFilter] = useState('all');
  const [period, setPeriod] = useState('week');
  const chartRef = useRef(null);
  const moneyRef = useRef(null);
  const chartsLoaded = useRef(false);

  useEffect(() => {
    loadKaspi();
  }, []);

  useEffect(() => {
    if (tab === 'показатели') {
      setTimeout(drawCharts, 300);
    }
  }, [tab, period]);

  async function loadKaspi() {
    setKaspiLoading(true);
    try {
      const r = await fetch('/api/kaspi/today');
      const data = await r.json();
      setKaspi(data);
    } catch (e) {
      console.error(e);
    }
    setKaspiLoading(false);
  }

  function drawCharts() {
    if (typeof window === 'undefined') return;
    if (!window.Chart) return;
    const sc = chartRef.current;
    const mc = moneyRef.current;
    if (!sc || !mc) return;

    const pData = {
      week: { labels:['Пн','Вт','Ср','Чт','Пт','Сб','Вс'], all:[320,480,290,720,610,950,580], kaspi:[140,220,120,380,280,490,260], inc:[280,420,260,680,560,870,500], exp:[120,180,110,290,240,380,210], bal:[160,240,150,390,320,490,290] },
      month: { labels:Array.from({length:30},(_,i)=>i+1+''), all:Array.from({length:30},(_,i)=>Math.round(200+Math.random()*400)), kaspi:Array.from({length:30},(_,i)=>Math.round(100+Math.random()*200)), inc:Array.from({length:30},(_,i)=>Math.round(150+Math.random()*350)), exp:Array.from({length:30},(_,i)=>Math.round(60+Math.random()*150)), bal:Array.from({length:30},(_,i)=>Math.round(90+Math.random()*200)) },
      year: { labels:['Қаң','Ақп','Нау','Сәу','Мам','Мау','Шіл','Там','Қыр','Қаз','Қар','Жел'], all:[42,48,38,55,62,58,72,68,75,80,88,95], kaspi:[18,22,16,26,30,28,36,33,37,39,43,47], inc:[38,43,34,50,57,52,66,62,68,73,81,88], exp:[18,21,16,24,28,25,32,30,33,36,40,43], bal:[20,22,18,26,29,27,34,32,35,37,41,45] }
    };
    const d = pData[period];
    const grid = { color:'rgba(255,255,255,0.05)' };
    const ticks = { color:'rgba(255,255,255,0.25)', font:{size:10,family:'Space Grotesk'} };

    if (sc._chart) sc._chart.destroy();
    sc._chart = new window.Chart(sc, { type:'line', data:{ labels:d.labels, datasets:[
      {label:'Барлық',data:d.all,borderColor:'rgba(167,139,250,0.9)',backgroundColor:'rgba(167,139,250,0.06)',borderWidth:2,tension:0.4,pointRadius:2,fill:true},
      {label:'Kaspi',data:d.kaspi,borderColor:'rgba(224,82,82,0.85)',backgroundColor:'transparent',borderWidth:2,borderDash:[4,3],tension:0.4,pointRadius:2,fill:false}
    ]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:true,grid:grid,ticks:ticks,border:{display:false}}}}});

    if (mc._chart) mc._chart.destroy();
    mc._chart = new window.Chart(mc, { type:'bar', data:{ labels:d.labels, datasets:[
      {label:'Кіріс',data:d.inc,backgroundColor:'rgba(52,211,153,0.45)',borderRadius:3,order:2},
      {label:'Шығыс',data:d.exp,backgroundColor:'rgba(224,82,82,0.35)',borderRadius:3,order:2},
      {label:'Баланс',data:d.bal,type:'line',borderColor:'rgba(167,139,250,0.9)',borderWidth:2,tension:0.4,pointRadius:0,fill:false,order:1}
    ]}, options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}},scales:{x:{display:false},y:{display:true,grid:grid,ticks:ticks,border:{display:false}}}}});
  }

  const newOrders = kaspi?.NEW?.data || [];
  const procOrders = kaspi?.PROCESSING?.data || [];
  const compOrders = kaspi?.COMPLETED?.data || [];
  const cancelOrders = kaspi?.CANCELLED?.data || [];
  const allActive = [...newOrders, ...procOrders];
  const todayRev = compOrders.reduce((s,o) => s + (o.attributes?.totalPrice || 0), 0);

  const filteredProds = PRODUCTS.filter(p => {
    const st = p.stock === 0 ? 'zero' : p.stock <= 10 ? 'low' : 'ok';
    if (prodFilter !== 'all' && st !== prodFilter) return false;
    if (prodSearch && !p.name.toLowerCase().includes(prodSearch.toLowerCase()) && !p.id.includes(prodSearch)) return false;
    return true;
  });

  const statusPill = (s) => {
    const map = {NEW:'b',PROCESSING:'a',COMPLETED:'g',CANCELLED:'r'};
    const name = {NEW:'Жаңа',PROCESSING:'Өңделуде',COMPLETED:'Аяқталды',CANCELLED:'Бас тартылды'};
    return <span className={`pill ${map[s]||'b'}`}>{name[s]||s}</span>;
  };

  return (
    <>
      <Head>
        <title>QOIMAM — Дашборд</title>
        <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet"/>
        <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js" async onLoad={drawCharts}/>
      </Head>
      <style>{css}</style>

      <div style={{display:'flex',height:'100vh',overflow:'hidden'}}>
        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="sb-logo">QOIM<span>AM</span></div>
          <div className="sb-sec">Меню</div>
          {[
            ['показатели','📊 Показатели',null],
            ['закупки','🛍 Закупки',null],
            ['продажа','🛒 Продажа', allActive.length > 0 ? allActive.length : null],
            ['товары','📦 Товары',null],
            ['склад','🏭 Склад',null],
            ['ии','🤖 ИИ',null],
            ['настройки','⚙️ Настройки',null],
          ].map(([key,label,badge]) => (
            <div key={key} className={`sb-link ${tab===key?'on':''}`} onClick={()=>setTab(key)}>
              {label}
              {badge && <span className="sb-badge b">{badge}</span>}
            </div>
          ))}
          <div className="sb-user">
            <div className="sb-av">АС</div>
            <div><div className="sb-un">Асель С.</div><div className="sb-up">Бизнес</div></div>
          </div>
        </aside>

        {/* MAIN */}
        <main className="d-main">

          {/* ── ПОКАЗАТЕЛИ ── */}
          {tab === 'показатели' && (
            <div>
              <div className="d-header">
                <div><div className="d-title">Показатели</div><div className="d-sub">Бейсенбі, 21 мамыр 2026</div></div>
                <div className="d-btns">
                  <div style={{display:'flex',gap:4,background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:8,padding:3}}>
                    {['week','month','year'].map(p => (
                      <button key={p} className={`per-btn ${period===p?'on':''}`} onClick={()=>setPeriod(p)}>
                        {p==='week'?'Апта':p==='month'?'Ай':'Жыл'}
                      </button>
                    ))}
                  </div>
                  <button className="d-btn" onClick={loadKaspi}>↺ Жаңарту</button>
                </div>
              </div>

              {/* Kaspi live stats */}
              <div className="kpi-row" style={{gridTemplateColumns:'repeat(4,1fr)'}}>
                <div className="kpi">
                  <div className="kpi-l">Kaspi жаңа заказ</div>
                  <div className="kpi-v" style={{color:'var(--accent)'}}>{kaspiLoading ? '...' : newOrders.length}</div>
                  <div className="kpi-ch up">↑ нақты уақыт</div>
                </div>
                <div className="kpi">
                  <div className="kpi-l">Өңделуде</div>
                  <div className="kpi-v">{kaspiLoading ? '...' : procOrders.length}</div>
                  <div className="kpi-ch up">↑ белсенді</div>
                </div>
                <div className="kpi">
                  <div className="kpi-l">Аяқталды бүгін</div>
                  <div className="kpi-v">{kaspiLoading ? '...' : compOrders.length}</div>
                  <div className="kpi-ch up" style={{color:'var(--green)'}}>{todayRev > 0 ? `₸ ${todayRev.toLocaleString('ru')}` : '—'}</div>
                </div>
                <div className="kpi">
                  <div className="kpi-l">Бас тартылды</div>
                  <div className="kpi-v" style={{color: cancelOrders.length > 0 ? 'var(--kaspi)' : 'inherit'}}>{kaspiLoading ? '...' : cancelOrders.length}</div>
                  <div className="kpi-ch dn">{cancelOrders.length > 0 ? '↓ тексеру керек' : '✓ норма'}</div>
                </div>
              </div>

              <div className="d-grid">
                {/* Charts */}
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div className="d-card">
                    <div className="d-card-h"><div className="d-card-t">Сатылым динамикасы</div><span className="pill g">↑ +24%</span></div>
                    <div style={{padding:'18px 18px 12px',height:150}}>
                      <canvas ref={chartRef}/>
                    </div>
                    <div style={{padding:'0 18px 12px',display:'flex',gap:16}}>
                      <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}><div style={{width:20,height:2,background:'rgba(167,139,250,0.9)',borderRadius:1}}/> Барлық</div>
                      <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}><div style={{width:20,height:2,background:'rgba(224,82,82,0.85)',borderRadius:1,borderTop:'2px dashed rgba(224,82,82,0.85)'}}/> Kaspi</div>
                    </div>
                  </div>

                  {/* Active Kaspi orders */}
                  <div className="d-card">
                    <div className="d-card-h">
                      <div className="d-card-t">Kaspi белсенді заказдар</div>
                      <div style={{display:'flex',alignItems:'center',gap:8}}>
                        <span className="pill r">{kaspiLoading ? '...' : `${allActive.length} белсенді`}</span>
                        <button className="d-btn" style={{fontSize:11,padding:'4px 10px'}} onClick={loadKaspi}>↺</button>
                      </div>
                    </div>
                    <div style={{maxHeight:240,overflowY:'auto'}}>
                      {kaspiLoading ? (
                        <div style={{padding:20,textAlign:'center',color:'var(--text3)',fontSize:13}}>Жүктелуде...</div>
                      ) : allActive.length === 0 ? (
                        <div style={{padding:20,textAlign:'center',color:'var(--text3)',fontSize:13}}>Белсенді заказ жоқ</div>
                      ) : allActive.slice(0,15).map((o, i) => {
                        const st = o.attributes?.state || 'NEW';
                        const price = o.attributes?.totalPrice;
                        const code = o.attributes?.code || o.id || `#${i}`;
                        const entries = o.attributes?.entries || [];
                        const name = entries[0]?.name || 'Тауар';
                        return (
                          <div key={i} className="ko">
                            <div className="ko-top">
                              <span className="ko-id">#{code}</span>
                              <span className="ko-price">{price ? `₸ ${price.toLocaleString('ru')}` : '—'}</span>
                            </div>
                            <div className="ko-name">{name}{entries.length > 1 ? ` +${entries.length-1}` : ''}</div>
                            <div className="ko-st">
                              <div className="kdot" style={{background: st==='NEW'?'var(--accent)':st==='PROCESSING'?'var(--amber)':'var(--green)'}}/>
                              {statusPill(st)}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Money chart */}
                <div style={{display:'flex',flexDirection:'column',gap:10}}>
                  <div className="d-card">
                    <div className="d-card-h"><div className="d-card-t">Кіріс / Шығыс</div></div>
                    <div style={{padding:'12px 18px',height:140}}>
                      <canvas ref={moneyRef}/>
                    </div>
                    <div style={{padding:'0 18px 12px',display:'flex',gap:12}}>
                      <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}><div style={{width:12,height:12,background:'rgba(52,211,153,0.5)',borderRadius:2}}/> Кіріс</div>
                      <div style={{display:'flex',alignItems:'center',gap:5,fontSize:11,color:'var(--text3)'}}><div style={{width:12,height:12,background:'rgba(224,82,82,0.4)',borderRadius:2}}/> Шығыс</div>
                    </div>
                  </div>

                  {/* Cancel orders */}
                  <div className="d-card">
                    <div className="d-card-h"><div className="d-card-t">Бас тартылған заказдар</div><span className="pill r">{cancelOrders.length}</span></div>
                    <div style={{maxHeight:200,overflowY:'auto'}}>
                      {cancelOrders.length === 0 ? (
                        <div style={{padding:20,textAlign:'center',color:'var(--green)',fontSize:13}}>✓ Бас тартылған заказ жоқ</div>
                      ) : cancelOrders.slice(0,8).map((o, i) => {
                        const code = o.attributes?.code || o.id || `#${i}`;
                        const price = o.attributes?.totalPrice;
                        const entries = o.attributes?.entries || [];
                        const name = entries[0]?.name || 'Тауар';
                        return (
                          <div key={i} className="ko">
                            <div className="ko-top"><span className="ko-id">#{code}</span><span className="ko-price">{price ? `₸ ${price.toLocaleString('ru')}` : '—'}</span></div>
                            <div className="ko-name">{name}</div>
                            <div className="ko-st"><div className="kdot" style={{background:'var(--kaspi)'}}/><span className="pill r" style={{fontSize:10,padding:'2px 7px'}}>Бас тартылды</span></div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ПРОДАЖА ── */}
          {tab === 'продажа' && (
            <div>
              <div className="d-header">
                <div><div className="d-title">Продажа — Kaspi заказдар</div><div className="d-sub">Нақты уақыт деректері</div></div>
                <div className="d-btns"><button className="d-btn p" onClick={loadKaspi}>↺ Жаңарту</button></div>
              </div>
              <div className="kpi-row">
                <div className="kpi"><div className="kpi-l">Жаңа</div><div className="kpi-v" style={{color:'var(--accent)'}}>{newOrders.length}</div><div className="kpi-ch up">↑ жаңа</div></div>
                <div className="kpi"><div className="kpi-l">Өңделуде</div><div className="kpi-v">{procOrders.length}</div><div className="kpi-ch up">белсенді</div></div>
                <div className="kpi"><div className="kpi-l">Аяқталды</div><div className="kpi-v" style={{color:'var(--green)'}}>{compOrders.length}</div><div className="kpi-ch up">↑ орындалды</div></div>
                <div className="kpi"><div className="kpi-l">Бас тартылды</div><div className="kpi-v" style={{color:cancelOrders.length>0?'var(--kaspi)':'inherit'}}>{cancelOrders.length}</div><div className="kpi-ch dn">отмена</div></div>
              </div>
              <div style={{padding:'0 26px 26px'}}>
                <div className="d-card">
                  <div className="d-card-h"><div className="d-card-t">Барлық Kaspi заказдар</div></div>
                  <div style={{overflowX:'auto',maxHeight:500,overflowY:'auto'}}>
                    <table className="d-table" style={{minWidth:700}}>
                      <thead style={{position:'sticky',top:0,background:'var(--bg2)',zIndex:1}}>
                        <tr><th>Код</th><th>Тауар</th><th style={{textAlign:'right'}}>Сумма ₸</th><th>Статус</th><th>Күні</th></tr>
                      </thead>
                      <tbody>
                        {[...newOrders,...procOrders,...compOrders,...cancelOrders].slice(0,100).map((o,i) => {
                          const st = o.attributes?.state || 'NEW';
                          const code = o.attributes?.code || o.id || i;
                          const price = o.attributes?.totalPrice;
                          const entries = o.attributes?.entries || [];
                          const name = entries[0]?.name || '—';
                          const date = o.attributes?.creationDate ? new Date(o.attributes.creationDate).toLocaleDateString('ru') : '—';
                          return (
                            <tr key={i}>
                              <td className="m" style={{fontSize:12}}>#{code}</td>
                              <td style={{fontSize:13}}>{name}{entries.length>1?` +${entries.length-1}`:''}</td>
                              <td style={{textAlign:'right',fontWeight:600}}>{price ? price.toLocaleString('ru') : '—'}</td>
                              <td>{statusPill(st)}</td>
                              <td className="m" style={{fontSize:12}}>{date}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {kaspiLoading && <div style={{padding:20,textAlign:'center',color:'var(--text3)'}}>Жүктелуде...</div>}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── СКЛАД ── */}
          {tab === 'склад' && (
            <div>
              <div className="d-header">
                <div><div className="d-title">Склад — Оприходования</div><div className="d-sub">Негізгі қойма · Classno · {PRODUCTS.length} позиция</div></div>
                <div className="d-btns"><button className="d-btn p">+ Оприходование</button></div>
              </div>
              <div className="kpi-row">
                <div className="kpi"><div className="kpi-l">Позиция</div><div className="kpi-v">{PRODUCTS.length}</div><div className="kpi-ch up">↑ негізгі қойма</div></div>
                <div className="kpi"><div className="kpi-l">Жалпы қалдық</div><div className="kpi-v">{PRODUCTS.reduce((s,p)=>s+p.stock,0).toLocaleString('ru')}</div><div className="kpi-ch up">↑ дана</div></div>
                <div className="kpi"><div className="kpi-l">Нөлдік қалдық</div><div className="kpi-v" style={{color:'var(--kaspi)'}}>{PRODUCTS.filter(p=>p.stock===0).length}</div><div className="kpi-ch dn">↓ тапсырыс беру</div></div>
                <div className="kpi"><div className="kpi-l">Қойма құны</div><div className="kpi-v" style={{fontSize:18}}>{Math.round(PRODUCTS.reduce((s,p)=>s+p.stock*p.buy,0)/1000000*10)/10} млн ₸</div><div className="kpi-ch up">↑ норма</div></div>
              </div>
              <div style={{padding:'0 26px 26px'}}>
                <div style={{display:'flex',gap:10,marginBottom:12}}>
                  <input style={{flex:1,background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:8,padding:'9px 14px',color:'var(--text)',fontFamily:'Space Grotesk, sans-serif',fontSize:13,outline:'none'}} placeholder="Іздеу..." value={prodSearch} onChange={e=>setProdSearch(e.target.value)}/>
                  <select style={{background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:8,padding:'9px 12px',color:'var(--text)',fontFamily:'Space Grotesk, sans-serif',fontSize:13,outline:'none'}} value={prodFilter} onChange={e=>setProdFilter(e.target.value)}>
                    <option value="all">Барлығы</option>
                    <option value="ok">Норма</option>
                    <option value="low">Аз (≤10)</option>
                    <option value="zero">Нөл</option>
                  </select>
                  <span style={{fontSize:12,color:'var(--text3)',alignSelf:'center',whiteSpace:'nowrap'}}>{filteredProds.length} позиция</span>
                </div>
                <div className="d-card">
                  <div style={{overflowX:'auto',maxHeight:560,overflowY:'auto'}}>
                    <table className="d-table" style={{minWidth:750}}>
                      <thead style={{position:'sticky',top:0,background:'var(--bg2)',zIndex:1}}>
                        <tr><th style={{width:32}}>№</th><th>Тауар атауы</th><th style={{textAlign:'right'}}>Артикул</th><th style={{textAlign:'right'}}>Қалдық</th><th style={{textAlign:'right'}}>Закуп ₸</th><th style={{textAlign:'right'}}>Сату ₸</th><th style={{textAlign:'right'}}>Сумма ₸</th><th style={{textAlign:'center'}}>Күй</th></tr>
                      </thead>
                      <tbody>
                        {filteredProds.map((p, i) => {
                          const st = p.stock===0?'zero':p.stock<=10?'low':'ok';
                          return (
                            <tr key={p.id} style={st!=='ok'?{background:'rgba(224,82,82,0.04)'}:{}}>
                              <td className="m" style={{fontSize:11}}>{i+1}</td>
                              <td style={{fontSize:13,fontWeight:500}}>{p.name}</td>
                              <td style={{textAlign:'right',fontSize:11,color:'var(--text3)'}}>{p.id}</td>
                              <td style={{textAlign:'right',fontWeight:700,color:st!=='ok'?'var(--kaspi)':'inherit'}}>{p.stock.toLocaleString('ru')}</td>
                              <td style={{textAlign:'right'}}>{p.buy.toLocaleString('ru')}</td>
                              <td style={{textAlign:'right',color:'var(--accent)'}}>{p.sell.toLocaleString('ru')}</td>
                              <td style={{textAlign:'right',fontWeight:600}}>{(p.stock*p.buy).toLocaleString('ru')}</td>
                              <td style={{textAlign:'center'}}><span className={`pill ${st==='zero'?'r':st==='low'?'r':'g'}`}>{st==='zero'?'Нөл':st==='low'?'Аз':'Норма'}</span></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  <div style={{padding:'12px 18px',borderTop:'1px solid var(--border)',fontSize:13,color:'var(--text2)',display:'flex',justifyContent:'space-between'}}>
                    <span>Жалпы: <strong>{filteredProds.length} позиция</strong></span>
                    <span>Құны: <strong style={{color:'var(--green)'}}>{filteredProds.reduce((s,p)=>s+p.stock*p.buy,0).toLocaleString('ru')} ₸</strong></span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ЗАКУПКИ ── */}
          {tab === 'закупки' && (
            <div>
              <div className="d-header">
                <div><div className="d-title">Закупки</div><div className="d-sub">Поставкаларды басқару</div></div>
                <div className="d-btns"><button className="d-btn p">+ Жаңа закупка</button></div>
              </div>
              <div style={{padding:'80px 26px',textAlign:'center',color:'var(--text3)'}}>
                <div style={{fontSize:32,marginBottom:12}}>🛍</div>
                <div style={{fontSize:15,marginBottom:8}}>Закупки бөлімі</div>
                <div style={{fontSize:13}}>МойСкладтан деректер қосылады</div>
              </div>
            </div>
          )}

          {/* ── ТОВАРЫ ── */}
          {tab === 'товары' && (
            <div>
              <div className="d-header">
                <div><div className="d-title">Товары</div><div className="d-sub">Каталог — {PRODUCTS.length} позиция</div></div>
                <div className="d-btns"><button className="d-btn p">+ Тауар қосу</button></div>
              </div>
              <div style={{padding:'0 26px 26px'}}>
                <div className="d-card">
                  <div style={{overflowX:'auto',maxHeight:600,overflowY:'auto'}}>
                    <table className="d-table" style={{minWidth:600}}>
                      <thead style={{position:'sticky',top:0,background:'var(--bg2)',zIndex:1}}>
                        <tr><th>Тауар</th><th style={{textAlign:'right'}}>Қалдық</th><th style={{textAlign:'right'}}>Закуп ₸</th><th style={{textAlign:'right'}}>Сату ₸</th></tr>
                      </thead>
                      <tbody>
                        {PRODUCTS.map((p,i) => (
                          <tr key={p.id}>
                            <td><div style={{fontSize:13,fontWeight:500}}>{p.name}</div><div style={{fontSize:11,color:'var(--text3)'}}>{p.id}</div></td>
                            <td style={{textAlign:'right',fontWeight:700,color:p.stock===0?'var(--kaspi)':p.stock<=10?'var(--amber)':'inherit'}}>{p.stock.toLocaleString('ru')}</td>
                            <td style={{textAlign:'right'}}>{p.buy.toLocaleString('ru')}</td>
                            <td style={{textAlign:'right',color:'var(--accent)'}}>{p.sell.toLocaleString('ru')}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── ИИ ── */}
          {tab === 'ии' && (
            <div>
              <div className="d-header">
                <div><div className="d-title">ИИ Ассистент</div><div className="d-sub">Kaspi деректері негізінде кеңес</div></div>
              </div>
              <div style={{padding:'0 26px 26px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="d-card">
                  <div className="d-card-h"><div className="d-card-t">💡 Инсайттар</div><span className="pill b">3 жаңа</span></div>
                  <div style={{padding:16,display:'flex',flexDirection:'column',gap:10}}>
                    {[
                      ['📈 Kaspi үлесі жоғары','Сатылымның 49% Kaspi арқылы келеді. Ассортиментті кеңейтіңіз.'],
                      ['⚠️ Нөлдік қалдық','4 тауар қалдығы нөл. Жедел тапсырыс беру керек.'],
                      ['🔴 Бас тартылған заказдар',`${cancelOrders.length > 0 ? cancelOrders.length + ' заказ бас тартылды — себептерін тексеріңіз.' : 'Бас тартылған заказ жоқ — жақсы!'}`],
                    ].map(([title, desc], i) => (
                      <div key={i} style={{background:'var(--bg3)',border:'1px solid var(--border)',borderRadius:9,padding:14}}>
                        <div style={{fontSize:13,fontWeight:600,marginBottom:5}}>{title}</div>
                        <div style={{fontSize:12,color:'var(--text2)'}}>{desc}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="d-card" style={{display:'flex',flexDirection:'column'}}>
                  <div className="d-card-h"><div className="d-card-t">🤖 ИИ чат</div><span className="pill g">Онлайн</span></div>
                  <div style={{flex:1,padding:16,display:'flex',flexDirection:'column',gap:10,minHeight:280}}>
                    <div style={{background:'var(--bg3)',borderRadius:9,padding:'12px 14px',maxWidth:'85%'}}>
                      <div style={{fontSize:12,color:'var(--text3)',marginBottom:4}}>ИИ</div>
                      <div style={{fontSize:13,color:'var(--text2)'}}>Сәлем! Kaspi деректеріңізді талдап тұрмын. Сұрағыңызды қойыңыз.</div>
                    </div>
                    <div style={{background:'var(--accent-bg)',border:'1px solid var(--accent-border)',borderRadius:9,padding:'12px 14px',maxWidth:'85%',alignSelf:'flex-end'}}>
                      <div style={{fontSize:13}}>Қанша заказ бар бүгін?</div>
                    </div>
                    <div style={{background:'var(--bg3)',borderRadius:9,padding:'12px 14px',maxWidth:'90%'}}>
                      <div style={{fontSize:12,color:'var(--text3)',marginBottom:4}}>ИИ</div>
                      <div style={{fontSize:13,color:'var(--text2)'}}>Бүгін Kaspi-да: {newOrders.length} жаңа + {procOrders.length} өңделуде = {newOrders.length+procOrders.length} белсенді заказ. Аяқталды: {compOrders.length}.</div>
                    </div>
                  </div>
                  <div style={{padding:'12px 16px',borderTop:'1px solid var(--border)',display:'flex',gap:8}}>
                    <input style={{flex:1,background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:8,padding:'9px 12px',color:'var(--text)',fontFamily:'Space Grotesk,sans-serif',fontSize:13,outline:'none'}} placeholder="Сұрақ қойыңыз..."/>
                    <button className="d-btn p" style={{padding:'9px 14px'}}>↑</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── НАСТРОЙКИ ── */}
          {tab === 'настройки' && (
            <div>
              <div className="d-header">
                <div><div className="d-title">Настройки</div><div className="d-sub">Аккаунт және интеграциялар</div></div>
                <div className="d-btns"><button className="d-btn p">Сақтау</button></div>
              </div>
              <div style={{padding:'0 26px 26px',display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                <div className="d-card">
                  <div className="d-card-h"><div className="d-card-t">Компания профилі</div></div>
                  <div style={{padding:18,display:'flex',flexDirection:'column',gap:14}}>
                    {[['Компания атауы','Classno ИП'],['Email','admin@classno.kz'],['Қала','Алматы']].map(([label,val])=>(
                      <div key={label}>
                        <div style={{fontSize:12,color:'var(--text3)',marginBottom:5}}>{label}</div>
                        <input defaultValue={val} style={{width:'100%',background:'var(--bg3)',border:'1px solid var(--border2)',borderRadius:8,padding:'9px 12px',color:'var(--text)',fontFamily:'Space Grotesk,sans-serif',fontSize:13,outline:'none'}}/>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="d-card">
                  <div className="d-card-h"><div className="d-card-t">Интеграциялар</div></div>
                  <div>
                    {[['🔴 Kaspi Магазин',true],['💳 Kaspi Pay',true],['📦 МойСклад',true],['🛒 Wildberries',false]].map(([name,conn])=>(
                      <div key={name} style={{padding:'14px 18px',borderBottom:'1px solid var(--border)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                        <div>
                          <div style={{fontSize:13,fontWeight:600}}>{name}</div>
                          <div style={{fontSize:11,color:conn?'var(--green)':'var(--text3)',marginTop:2}}>{conn?'● Қосылған':'○ Қосылмаған'}</div>
                        </div>
                        <button className={`d-btn ${conn?'':'p'}`} style={{fontSize:12,padding:'6px 12px'}}>{conn?'Баптау':'Қосу'}</button>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </>
  );
}

const css = `
*{margin:0;padding:0;box-sizing:border-box;}
html,body{height:100%;background:#0C0C0C;color:#F2F2F2;font-family:'Space Grotesk',sans-serif;-webkit-font-smoothing:antialiased;}
:root{
  --bg:#0C0C0C;--bg2:#111111;--bg3:#171717;--bg4:#1C1C1C;
  --border:rgba(255,255,255,0.06);--border2:rgba(255,255,255,0.1);--border3:rgba(255,255,255,0.16);
  --text:#F2F2F2;--text2:rgba(255,255,255,0.45);--text3:rgba(255,255,255,0.22);
  --accent:#A78BFA;--accent2:#8B5CF6;--accent-bg:rgba(167,139,250,0.08);--accent-border:rgba(167,139,250,0.2);
  --kaspi:#E05252;--kaspi-bg:rgba(224,82,82,0.07);--kaspi-border:rgba(224,82,82,0.18);
  --green:#34D399;--green-bg:rgba(52,211,153,0.07);--amber:#FBBF24;--amber-bg:rgba(251,191,36,0.07);
  --sh:0 1px 3px rgba(0,0,0,0.4),0 4px 20px rgba(0,0,0,0.3);
  --sh-sm:0 1px 2px rgba(0,0,0,0.3);
}
.sidebar{width:216px;flex-shrink:0;background:var(--bg2);border-right:1px solid var(--border);height:100vh;padding:18px 10px;display:flex;flex-direction:column;gap:1px;overflow-y:auto;}
.sb-logo{font-size:16px;font-weight:700;letter-spacing:-0.2px;padding:4px 10px 16px;border-bottom:1px solid var(--border);margin-bottom:10px;}
.sb-logo span{color:var(--accent);}
.sb-sec{font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:1.2px;color:var(--text3);padding:12px 10px 5px;}
.sb-link{display:flex;align-items:center;gap:9px;padding:8px 10px;border-radius:8px;font-size:13px;font-weight:500;color:var(--text2);cursor:pointer;transition:all 0.15s;}
.sb-link:hover{background:var(--bg3);color:var(--text);}
.sb-link.on{background:var(--accent-bg);color:var(--accent);}
.sb-badge{margin-left:auto;font-size:10px;font-weight:700;padding:2px 7px;border-radius:100px;}
.sb-badge.b{background:var(--accent-bg);color:var(--accent);border:1px solid var(--accent-border);}
.sb-user{margin-top:auto;border-top:1px solid var(--border);padding:14px 10px 2px;display:flex;align-items:center;gap:9px;}
.sb-av{width:32px;height:32px;border-radius:8px;background:var(--accent2);color:#fff;font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0;}
.sb-un{font-size:13px;font-weight:600;}.sb-up{font-size:11px;color:var(--text3);}
.d-main{flex:1;height:100vh;overflow-y:auto;}
.d-header{padding:22px 26px 0;display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px;}
.d-title{font-size:22px;font-weight:700;letter-spacing:-0.5px;}
.d-sub{font-size:13px;color:var(--text3);margin-top:2px;}
.d-btns{display:flex;gap:8px;align-items:center;}
.d-btn{padding:8px 16px;border-radius:8px;font-size:13px;font-weight:500;cursor:pointer;font-family:'Space Grotesk',sans-serif;border:1px solid var(--border2);background:var(--bg3);color:var(--text2);transition:all 0.18s;}
.d-btn:hover{color:var(--text);}
.d-btn.p{background:var(--text);color:var(--bg);border-color:var(--text);}
.d-btn.p:hover{background:rgba(242,242,242,0.9);}
.kpi-row{display:grid;gap:10px;padding:0 26px 18px;}
.kpi{background:var(--bg2);border:1px solid var(--border);border-radius:12px;padding:18px 20px;box-shadow:var(--sh-sm);}
.kpi-l{font-size:12px;color:var(--text3);margin-bottom:8px;}
.kpi-v{font-size:24px;font-weight:700;letter-spacing:-0.8px;margin-bottom:5px;}
.kpi-ch{font-size:12px;font-weight:500;}
.kpi-ch.up{color:var(--green);}.kpi-ch.dn{color:var(--kaspi);}
.d-grid{display:grid;grid-template-columns:1.55fr 1fr;gap:10px;padding:0 26px 26px;}
.d-card{background:var(--bg2);border:1px solid var(--border);border-radius:12px;overflow:hidden;box-shadow:var(--sh-sm);}
.d-card-h{padding:15px 18px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;}
.d-card-t{font-size:14px;font-weight:600;}
.pill{font-size:11px;font-weight:600;padding:3px 10px;border-radius:100px;}
.pill.g{background:var(--green-bg);color:var(--green);}
.pill.r{background:var(--kaspi-bg);color:var(--kaspi);}
.pill.b{background:var(--accent-bg);color:var(--accent);}
.pill.a{background:var(--amber-bg);color:var(--amber);}
.d-table{width:100%;border-collapse:collapse;}
.d-table th{font-size:11px;color:var(--text3);font-weight:600;text-transform:uppercase;letter-spacing:0.5px;padding:10px 18px;border-bottom:1px solid var(--border);text-align:left;}
.d-table td{padding:11px 18px;font-size:13px;border-bottom:1px solid var(--border);}
.d-table tr:last-child td{border-bottom:none;}
.d-table td.m{color:var(--text2);}
.ko{padding:13px 16px;border-bottom:1px solid var(--border);}
.ko:last-child{border-bottom:none;}
.ko-top{display:flex;justify-content:space-between;margin-bottom:4px;}
.ko-id{font-size:11px;color:var(--text3);}
.ko-price{font-size:13px;font-weight:700;}
.ko-name{font-size:13px;font-weight:500;margin-bottom:5px;}
.ko-st{font-size:11px;color:var(--text2);display:flex;align-items:center;gap:5px;}
.kdot{width:5px;height:5px;border-radius:50%;}
.per-btn{padding:6px 14px;border-radius:6px;border:none;background:transparent;color:var(--text2);font-size:13px;font-weight:500;cursor:pointer;font-family:'Space Grotesk',sans-serif;transition:all 0.18s;}
.per-btn:hover{color:var(--text);}
.per-btn.on{background:var(--bg4);color:var(--text);border:1px solid var(--border2);}
`;
