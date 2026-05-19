/**
 * app/pokazateli/page.tsx
 *
 * Страница «Показатели» — клиентский компонент, тянет данные из /api/pokazateli.
 */

'use client';

import { useEffect, useState } from 'react';
import styles from './pokazateli.module.css';

interface SalesMetric {
  count: number;
  revenue: number;
  diff: number;
  diffPct: number;
  direction: 'up' | 'down';
}

interface PokazateliData {
  updatedAt: number;
  sales: {
    today: SalesMetric;
    week: SalesMetric;
    month: SalesMetric;
  };
  chart: {
    current: number[];
    previous: number[];
  };
  overdue: {
    count: number;
    sum: number;
    list: { code: string; sum: number; date: number; daysOverdue: number }[];
  };
  returns: {
    count: number;
    sum: number;
    list: { code: string; sum: number; date: number }[];
  };
}

const WEEKDAYS = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'вс'];

function formatNum(n: number): string {
  return new Intl.NumberFormat('ru-RU').format(Math.round(n));
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString('ru-RU');
}

export default function PokazateliPage() {
  const [data, setData] = useState<PokazateliData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState('month');

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/pokazateli?period=${period}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Ошибка загрузки');
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Неизвестная ошибка');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  // Построение SVG-пути для линии графика
  const buildChartPath = (values: number[], maxVal: number): string => {
    if (values.length === 0) return '';
    const width = 700;
    const height = 240;
    const step = width / (values.length - 1);
    return values
      .map((v, i) => {
        const x = i * step;
        const y = maxVal === 0 ? height : height - (v / maxVal) * height;
        return `${i === 0 ? 'M' : 'L'}${x},${y}`;
      })
      .join(' ');
  };

  if (loading && !data) {
    return (
      <div className={styles.main}>
        <div className={styles.topbar}>
          <h1>Показатели</h1>
        </div>
        <div className={styles.section}>
          <div style={{ padding: '40px', textAlign: 'center', color: '#A1A1AA' }}>
            Загрузка данных из Kaspi…
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.main}>
        <div className={styles.topbar}>
          <h1>Показатели</h1>
        </div>
        <div className={styles.section}>
          <div style={{ padding: '40px', textAlign: 'center', color: '#EF4444' }}>
            <strong>Ошибка:</strong> {error}
            <br />
            <br />
            <button className={styles.btn} onClick={load}>
              Попробовать снова
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const maxChart = Math.max(...data.chart.current, ...data.chart.previous, 1);
  const yAxisLabels = [4, 3, 2, 1, 0].map(i => Math.round((maxChart / 4) * i));

  return (
    <div className={styles.main}>
      <div className={styles.topbar}>
        <h1>Показатели</h1>
        <div className={styles.topbarRight}>
          <select
            className={styles.periodSelect}
            value={period}
            onChange={e => setPeriod(e.target.value)}
          >
            <option value="week">За 7 дней</option>
            <option value="month">За 30 дней</option>
            <option value="quarter">За 90 дней</option>
          </select>
          <button className={styles.btn} onClick={load} disabled={loading}>
            {loading ? 'Обновление…' : '↻ Обновить'}
          </button>
        </div>
      </div>

      {/* ПРОДАЖИ */}
      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <div className={styles.sectionTitle}>Продажи</div>
          <div className={styles.sectionActions}>
            <button className={`${styles.tab} ${period === 'week' ? styles.tabActive : ''}`} onClick={() => setPeriod('week')}>
              Неделя
            </button>
            <button className={`${styles.tab} ${period === 'month' ? styles.tabActive : ''}`} onClick={() => setPeriod('month')}>
              Месяц
            </button>
            <button className={`${styles.tab} ${period === 'year' ? styles.tabActive : ''}`} onClick={() => setPeriod('year')}>
              Год
            </button>
          </div>
        </div>

        <div className={styles.salesGrid}>
          {/* Метрики */}
          <div>
            <MetricBlock
              label={`Сегодня, ${new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}`}
              metric={data.sales.today}
              compareLabel="По сравнению со вчера"
            />
            <MetricBlock
              label="На этой неделе"
              metric={data.sales.week}
              compareLabel="По сравнению с прошлой неделей"
            />
            <MetricBlock
              label="В этом месяце"
              metric={data.sales.month}
              compareLabel="По сравнению с прошлым месяцем"
            />
          </div>

          {/* График */}
          <div>
            <div className={styles.chartContainer}>
              <div className={styles.chartYaxis}>
                {yAxisLabels.map((v, i) => (
                  <span key={i}>{formatNum(v)}</span>
                ))}
              </div>
              <svg className={styles.chartSvg} viewBox="0 0 700 240" preserveAspectRatio="none">
                <g stroke="#26262C" strokeWidth="1">
                  <line x1="0" y1="0" x2="700" y2="0" />
                  <line x1="0" y1="60" x2="700" y2="60" />
                  <line x1="0" y1="120" x2="700" y2="120" />
                  <line x1="0" y1="180" x2="700" y2="180" />
                  <line x1="0" y1="240" x2="700" y2="240" />
                </g>
                <path
                  d={buildChartPath(data.chart.previous, maxChart)}
                  fill="none"
                  stroke="#71717A"
                  strokeWidth="1.8"
                  strokeDasharray="4 4"
                />
                <path
                  d={buildChartPath(data.chart.current, maxChart)}
                  fill="none"
                  stroke="#F59E0B"
                  strokeWidth="2.5"
                />
                {data.chart.current.map((v, i) => {
                  const x = i * (700 / 6);
                  const y = maxChart === 0 ? 240 : 240 - (v / maxChart) * 240;
                  return <circle key={i} cx={x} cy={y} r="3.5" fill="#F59E0B" />;
                })}
              </svg>
              <div className={styles.chartXaxis}>
                {WEEKDAYS.map(d => (
                  <span key={d}>{d}</span>
                ))}
              </div>
            </div>
            <div className={styles.chartLegend}>
              <div className={styles.legendItem}>
                <span className={styles.legendLine} style={{ background: '#F59E0B' }} />
                Эта неделя
              </div>
              <div className={styles.legendItem}>
                <span
                  className={styles.legendLine}
                  style={{ background: 'transparent', borderTop: '2px dashed #71717A' }}
                />
                Прошлая неделя
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ПРОСРОЧЕННЫЕ ЗАКАЗЫ + ВОЗВРАТЫ */}
      <div className={styles.twocol}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Просроченные заказы</div>
          </div>
          <div className={styles.overdueStat}>
            <div className={styles.metricNum}>
              <div className={styles.value}>{data.overdue.count}</div>
              <div className={styles.unit}>заказов</div>
            </div>
            <div className={styles.metricNum}>
              <div className={styles.value}>{formatNum(data.overdue.sum)}</div>
              <div className={styles.unit}>тенге</div>
            </div>
          </div>
          {data.overdue.list.length > 0 ? (
            <>
              <div className={styles.tableHeader}>
                <span>Код заказа</span>
                <span style={{ textAlign: 'right' }}>Сумма</span>
                <span style={{ textAlign: 'right' }}>Дата</span>
                <span style={{ textAlign: 'right' }}>Дней</span>
              </div>
              {data.overdue.list.map(o => (
                <div key={o.code} className={styles.tableRow}>
                  <span>{o.code}</span>
                  <span className={styles.num}>{formatNum(o.sum)} ₸</span>
                  <span className={styles.num}>{formatDate(o.date)}</span>
                  <span className={styles.num} style={{ color: o.daysOverdue >= 3 ? '#EF4444' : '#F59E0B' }}>
                    {o.daysOverdue}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <div className={styles.emptyRow}>Просроченных заказов нет 🎉</div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <div className={styles.sectionTitle}>Возвраты</div>
          </div>
          <div className={styles.overdueStat}>
            <div className={styles.metricNum}>
              <div className={styles.value}>{data.returns.count}</div>
              <div className={styles.unit}>возвратов</div>
            </div>
            <div className={styles.metricNum}>
              <div className={styles.value}>{formatNum(data.returns.sum)}</div>
              <div className={styles.unit}>тенге</div>
            </div>
          </div>
          {data.returns.list.length > 0 ? (
            <>
              <div className={styles.tableHeader} style={{ gridTemplateColumns: '1fr 100px 90px' }}>
                <span>Код заказа</span>
                <span style={{ textAlign: 'right' }}>Сумма</span>
                <span style={{ textAlign: 'right' }}>Дата</span>
              </div>
              {data.returns.list.map(o => (
                <div key={o.code} className={styles.tableRow} style={{ gridTemplateColumns: '1fr 100px 90px' }}>
                  <span>{o.code}</span>
                  <span className={styles.num}>{formatNum(o.sum)} ₸</span>
                  <span className={styles.num}>{formatDate(o.date)}</span>
                </div>
              ))}
            </>
          ) : (
            <div className={styles.emptyRow}>Возвратов нет 🎉</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 16, fontSize: 12, color: '#71717A', textAlign: 'center' }}>
        Обновлено: {new Date(data.updatedAt).toLocaleString('ru-RU')}
      </div>
    </div>
  );
}

function MetricBlock({
  label,
  metric,
  compareLabel,
}: {
  label: string;
  metric: SalesMetric;
  compareLabel: string;
}) {
  return (
    <div className={styles.metricBlock}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricRow}>
        <div className={styles.metricNum}>
          <div className={styles.value}>{metric.count}</div>
          <div className={styles.unit}>{metric.count === 1 ? 'продажа' : 'продаж'}</div>
        </div>
        <div className={styles.metricNum}>
          <div className={styles.value}>{formatNum(metric.revenue)}</div>
          <div className={styles.unit}>тенге</div>
        </div>
      </div>
      <div className={`${styles.metricChange} ${metric.direction === 'up' ? styles.up : styles.down}`}>
        <span className={`${styles.metricChangeArrow} ${metric.direction === 'up' ? styles.arrowUp : styles.arrowDown}`} />
        <span className={styles.num}>
          {formatNum(Math.abs(metric.diff))} тенге ({Math.abs(metric.diffPct)}%)
        </span>
        <small>{compareLabel}</small>
      </div>
    </div>
  );
}
