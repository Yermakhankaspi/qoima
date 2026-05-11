// =============================================================
//  GET /api/diag
//  Диагностика: показывает какие переменные окружения доступны
//  для базы данных и Kaspi API. Значения НЕ показываются — только
//  наличие/отсутствие.
// =============================================================
export default function handler(req, res) {
  const relevant = [
    // Upstash Redis (новый Vercel marketplace)
    'UPSTASH_REDIS_REST_URL',
    'UPSTASH_REDIS_REST_TOKEN',
    // Vercel KV (legacy, до декабря 2024)
    'KV_REST_API_URL',
    'KV_REST_API_TOKEN',
    'KV_URL',
    // Generic Redis (старый «Redis Cloud» через TCP)
    'REDIS_URL',
    // Kaspi
    'KASPI_API_TOKEN',
  ];

  const envStatus = {};
  for (const key of relevant) {
    envStatus[key] = process.env[key] ? '✓ установлена' : '✗ не установлена';
  }

  // Подсказка
  let advice;
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    advice = '✅ ОК: используется Upstash Redis (новый формат). Авторизация должна работать.';
  } else if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
    advice = '✅ ОК: используется legacy KV формат. Авторизация должна работать.';
  } else if (process.env.REDIS_URL) {
    advice = '⚠️ Внимание: установлен только REDIS_URL (TCP). Этого недостаточно для serverless. Нужно установить интеграцию Upstash Redis из маркетплейса Vercel — она добавит UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN.';
  } else {
    advice = '❌ База не подключена. В Vercel: Storage → Browse Marketplace → найди "Upstash" → Install → Connect к проекту moden.';
  }

  res.status(200).json({
    env: envStatus,
    advice,
    nodeVersion: process.version,
  });
}
