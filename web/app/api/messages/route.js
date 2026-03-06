const { NextResponse } = require('next/server');
const { getSessionFromRequest } = require('@/lib/auth');
const { query } = require('@/lib/db');
const { callAllModels, callJudge } = require('@/lib/models');

async function POST(request) {
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
  const { thread_id: threadId, content: rawContent, mode } = body || {};
  const content = (rawContent || '').toString().trim();
  if (!threadId || !content) {
    return NextResponse.json({ error: 'thread_id and content required' }, { status: 400 });
  }

  const effectiveMode = mode === 'best' || mode === 'cheap' ? mode : null;

  try {
    const {
      rows: [thread],
    } = await query(
      'SELECT id, title FROM threads WHERE id = $1 AND user_id = $2',
      [threadId, session.sub]
    );
    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 });
    }

    let useMode = effectiveMode;
    if (!useMode) {
      const {
        rows: [u],
      } = await query('SELECT preferred_mode FROM users WHERE id = $1', [session.sub]);
      useMode = u?.preferred_mode === 'best' ? 'best' : 'cheap';
    }

    const {
      rows: [userMsg],
    } = await query(
      'INSERT INTO messages (thread_id, user_id, role, content) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
      [threadId, session.sub, 'user', content]
    );
    if (!userMsg) {
      return NextResponse.json({ error: 'Failed to save message' }, { status: 500 });
    }

    const messageCountResult = await query(
      'SELECT COUNT(*)::int AS c FROM messages WHERE thread_id = $1 AND role = $2',
      [threadId, 'user']
    );
    const isFirstMessage = messageCountResult.rows[0]?.c === 1;
    if (isFirstMessage) {
      const title = content.slice(0, 40).trim() || 'New chat';
      await query('UPDATE threads SET title = $1, updated_at = NOW() WHERE id = $2', [
        title,
        threadId,
      ]);
    } else {
      await query('UPDATE threads SET updated_at = NOW() WHERE id = $1', [threadId]);
    }

    const messages = [{ role: 'user', content }];
    const modelResults = await callAllModels(messages, useMode);

    for (const r of modelResults) {
      await query(
        `INSERT INTO model_responses (message_id, model_name, content, ok, error)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          userMsg.id,
          r.model,
          r.ok ? r.content : null,
          r.ok,
          r.error ? JSON.stringify(r.error) : null,
        ]
      );
    }

    let summaryContent = null;
    try {
      summaryContent = await callJudge(
        content,
        modelResults.map((r) => ({ model: r.model, ok: r.ok, content: r.content, error: r.error })),
        useMode
      );
    } catch (_) { }
    if (summaryContent) {
      await query(
        'INSERT INTO summaries (message_id, content) VALUES ($1, $2)',
        [userMsg.id, summaryContent]
      );
    }

    const { rows: modelResponses } = await query(
      'SELECT model_name, content, ok, error FROM model_responses WHERE message_id = $1 ORDER BY model_name',
      [userMsg.id]
    );
    const { rows: sumRows } = await query(
      'SELECT content FROM summaries WHERE message_id = $1 LIMIT 1',
      [userMsg.id]
    );

    return NextResponse.json({
      message: {
        id: userMsg.id,
        thread_id: threadId,
        role: 'user',
        content,
        created_at: userMsg.created_at,
      },
      model_responses: modelResponses,
      summary: sumRows[0]?.content ?? null,
    });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 500 });
  }
}

module.exports = { POST };
