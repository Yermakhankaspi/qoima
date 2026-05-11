// GET /api/diag — диагностика окружения
export default function handler(req, res) {
  const relevant = [
    'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
    'KV_REST_API_URL', 'KV_REST_API_TOKEN', 'KV_URL',
    'REDIS_URL', 'KASPI_API_TOKEN',
  ];
  const env = {};
  for (const k of relevant) env[k] = process.env[k] ? '✓' : '✗';

  let advice;
  if ((process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL) &&
      (process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN)) {
    advice = '✅ База данных подключена корректно.';
  } else {
    advice = '❌ База не подключена. Подключи Upstash for Redis в Storage.';
  }

  res.status(200).json({ env, advice, nodeVersion: process.version });
}
