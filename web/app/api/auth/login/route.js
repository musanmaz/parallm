const { NextResponse } = require('next/server');
const bcrypt = require('bcryptjs');
const { query } = require('@/lib/db');
const { createToken, getCookieOptions } = require('@/lib/auth');
const { isRateLimited } = require('@/lib/rateLimit');

async function POST(request) {
  try {
    if (isRateLimited(request)) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }
    const body = await request.json();
    const { username, password } = body || {};
    const u = (username || '').trim().toLowerCase();
    if (!u) {
      return NextResponse.json({ error: 'Username is required' }, { status: 400 });
    }
    if (!password || typeof password !== 'string') {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 });
    }
    const {
      rows: [user],
    } = await query('SELECT id, username, email, password_hash FROM users WHERE username = $1', [u]);
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
    }
    const token = await createToken({ sub: user.id, username: user.username });
    const opts = getCookieOptions();
    const res = NextResponse.json({
      user: { id: user.id, username: user.username },
    });
    res.cookies.set(process.env.COOKIE_NAME || 'multi_llm_session', token, {
      httpOnly: true,
      secure: opts.secure,
      sameSite: opts.sameSite,
      maxAge: opts.maxAge,
      path: '/',
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}

module.exports = { POST };
