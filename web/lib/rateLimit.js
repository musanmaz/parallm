const limit = 20;
const windowMs = 60 * 1000;
const store = new Map();

function getClientId(req) {
  const forwarded = req.headers.get?.('x-forwarded-for') || req.headers['x-forwarded-for'];
  const ip = forwarded ? String(forwarded).split(',')[0].trim() : req.socket?.remoteAddress || 'unknown';
  return ip;
}

function isRateLimited(req) {
  const key = getClientId(req);
  const now = Date.now();
  if (!store.has(key)) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return false;
  }
  const entry = store.get(key);
  if (now > entry.resetAt) {
    entry.count = 1;
    entry.resetAt = now + windowMs;
    return false;
  }
  entry.count += 1;
  if (entry.count > limit) return true;
  return false;
}

module.exports = { isRateLimited, getClientId };
