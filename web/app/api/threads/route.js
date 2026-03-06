const { NextResponse } = require('next/server');
const { getSessionFromRequest } = require('@/lib/auth');
const { query } = require('@/lib/db');

async function GET(request) {
  const session = await getSessionFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const { rows } = await query(
      'SELECT id, title, created_at, updated_at FROM threads WHERE user_id = $1 ORDER BY updated_at DESC',
      [session.sub]
    );
    return NextResponse.json({ threads: rows });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to list threads' }, { status: 500 });
  }
}

async function POST(request) {
  const session = await getSessionFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await request.json().catch(() => ({}));
    const title = (body.title || 'New chat').toString().slice(0, 500) || 'New chat';
    const {
      rows: [row],
    } = await query(
      'INSERT INTO threads (user_id, title) VALUES ($1, $2) RETURNING id, title, created_at, updated_at',
      [session.sub, title]
    );
    return NextResponse.json(row);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to create thread' }, { status: 500 });
  }
}

module.exports = { GET, POST };
