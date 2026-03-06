const { NextResponse } = require('next/server');
const { getSessionFromRequest } = require('@/lib/auth');
const { query } = require('@/lib/db');

async function GET(request, { params }) {
  const session = await getSessionFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const threadId = params?.threadId;
  if (!threadId) {
    return NextResponse.json({ error: 'Thread ID required' }, { status: 400 });
  }
  try {
    const {
      rows: [thread],
    } = await query(
      'SELECT id, title, created_at, updated_at FROM threads WHERE id = $1 AND user_id = $2',
      [threadId, session.sub]
    );
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    const { rows: messages } = await query(
      `SELECT m.id, m.thread_id, m.role, m.content, m.created_at,
        (SELECT json_agg(json_build_object('model_name', mr.model_name, 'content', mr.content, 'ok', mr.ok, 'error', mr.error))
         FROM model_responses mr WHERE mr.message_id = m.id) AS model_responses,
        (SELECT s.content FROM summaries s WHERE s.message_id = m.id LIMIT 1) AS summary
       FROM messages m
       WHERE m.thread_id = $1
       ORDER BY m.created_at ASC`,
      [threadId]
    );
    return NextResponse.json({ ...thread, messages });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to load thread' }, { status: 500 });
  }
}

async function DELETE(request, { params }) {
  const session = await getSessionFromRequest(request);
  if (!session?.sub) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const threadId = params?.threadId;
  if (!threadId) {
    return NextResponse.json({ error: 'Thread ID required' }, { status: 400 });
  }
  try {
    const { rowCount } = await query(
      'DELETE FROM threads WHERE id = $1 AND user_id = $2',
      [threadId, session.sub]
    );
    if (rowCount === 0) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to delete thread' }, { status: 500 });
  }
}

module.exports = { GET, DELETE };
