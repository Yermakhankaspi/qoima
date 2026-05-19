/**
 * api/_lib/session.js
 *
 * Простая cookie-сессия. Без зависимостей, на встроенном crypto.
 * Cookie хранит подписанный HMAC-SHA256 токен с истечением.
 */

import crypto from 'node:crypto';

const COOKIE_NAME = 'qoima_session';
const COOKIE_MAX_AGE = 30 * 24 * 60 * 60; // 30 дней

function getSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error('SESSION_SECRET не задан или короче 16 символов. Задайте в Vercel Environment Variables.');
  }
  return secret;
}

/**
 * Создать подписанный токен.
 */
export function createSession(userName) {
  const payload = {
    user: userName,
    exp: Date.now() + COOKIE_MAX_AGE * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url');
  return `${payloadB64}.${signature}`;
}

/**
 * Проверить токен. Вернуть payload или null.
 */
export function verifySession(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  const [payloadB64, signature] = parts;
  const expected = crypto
    .createHmac('sha256', getSecret())
    .update(payloadB64)
    .digest('base64url');

  if (signature !== expected) return null;

  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString());
    if (!payload.exp || payload.exp < Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

/**
 * Достать токен из заголовков Cookie.
 */
export function getSessionFromRequest(req) {
  const cookieHeader = req.headers.cookie || '';
  const cookies = Object.fromEntries(
    cookieHeader.split(';').map(c => {
      const [k, ...v] = c.trim().split('=');
      return [k, v.join('=')];
    })
  );
  const token = cookies[COOKIE_NAME];
  return verifySession(token);
}

/**
 * Поставить cookie с сессией в response.
 */
export function setSessionCookie(res, token) {
  const cookie = `${COOKIE_NAME}=${token}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}`;
  res.setHeader('Set-Cookie', cookie);
}

/**
 * Очистить cookie.
 */
export function clearSessionCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`);
}

/**
 * Middleware-функция для защиты эндпоинтов.
 * Если не залогинен — возвращает 401 и завершает запрос.
 */
export function requireAuth(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    res.status(401).json({ error: 'Не авторизован' });
    return null;
  }
  return session;
}
