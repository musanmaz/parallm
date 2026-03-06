const { NextResponse } = require('next/server');
const { getSessionFromRequest } = require('@/lib/auth');
const { query } = require('@/lib/db');

async function GET(request) {
  const session = await getSessionFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ user: null }, { status: 200 });
  }
  try {
    const {
      rows: [user],
    } = await query(
      'SELECT id, username, email, preferred_mode, created_at FROM users WHERE id = $1',
      [session.sub]
    );
    if (!user) {
      return NextResponse.json({ user: null }, { status: 200 });
    }
    return NextResponse.json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        preferred_mode: user.preferred_mode,
        created_at: user.created_at,
      },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 200 });
  }
}

async function PATCH(request) {
  const session = await getSessionFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const mode = body?.preferred_mode;
  if (mode !== 'cheap' && mode !== 'best') {
    return NextResponse.json({ error: 'preferred_mode must be cheap or best' }, { status: 400 });
  }
  try {
    await query('UPDATE users SET preferred_mode = $1 WHERE id = $2', [mode, session.sub]);
    return NextResponse.json({ preferred_mode: mode });
  } catch {
    return NextResponse.json({ error: 'Update failed' }, { status: 500 });
  }
}

module.exports = { GET, PATCH };
