const { getRedis, parseCookies } = require("../_lib/shared");

module.exports = async function handler(req, res) {
  try {
    const cookies = parseCookies(req.headers.cookie);
    const redis = getRedis();
    if (redis && cookies.session) await redis.del(`session:${cookies.session}`);
  } catch {}
  res.setHeader("Set-Cookie", "session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0");
  return res.status(200).json({ ok: true });
};
