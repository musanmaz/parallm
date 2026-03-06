const { SignJWT, jwtVerify } = require('jose');

const COOKIE_NAME = process.env.COOKIE_NAME || 'multi_llm_session';
const COOKIE_MAX_AGE = parseInt(process.env.COOKIE_MAX_AGE_SECONDS || '604800', 10);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-min-32-characters-long!!';

const secret = new TextEncoder().encode(JWT_SECRET);

function getCookieOptions() {
  const isProd = process.env.NODE_ENV === 'production';
  return {
    httpOnly: true,
    secure: isProd,
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  };
}

async function createToken(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${COOKIE_MAX_AGE}s`)
    .sign(secret);
}

async function verifyToken(token) {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload;
  } catch {
    return null;
  }
}

async function setSessionCookie(res, userId, email) {
  const token = await createToken({ sub: userId, email });
  const opts = getCookieOptions();
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=${token}; Path=${opts.path}; Max-Age=${opts.maxAge}; HttpOnly; SameSite=${opts.sameSite}${opts.secure ? '; Secure' : ''}`
  );
}

function clearSessionCookie(res) {
  res.setHeader(
    'Set-Cookie',
    `${COOKIE_NAME}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax`
  );
}

async function getSessionFromRequest(req) {
  const cookieHeader = req.headers.get?.('cookie') || req.headers.cookie;
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const token = match?.[1];
  if (!token) return null;
  return verifyToken(token);
}

module.exports = {
  COOKIE_NAME,
  COOKIE_MAX_AGE,
  getCookieOptions,
  createToken,
  verifyToken,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromRequest,
};
