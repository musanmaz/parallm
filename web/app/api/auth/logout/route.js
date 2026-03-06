const { NextResponse } = require('next/server');

const COOKIE_NAME = process.env.COOKIE_NAME || 'multi_llm_session';

async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    sameSite: 'lax',
  });
  return res;
}

module.exports = { POST };
