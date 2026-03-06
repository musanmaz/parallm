const { getSessionFromRequest } = require('@/lib/auth');
const { query } = require('@/lib/db');
const { callLiteLLM, callJudge, MODELS_CHEAP, MODELS_BEST } = require('@/lib/models');
const { SYSTEM_PROMPT } = require('@/lib/prompt');

function ndjson(controller, obj) {
  controller.enqueue(new TextEncoder().encode(JSON.stringify(obj) + '\n'));
}

async function POST(request) {
  const session = await getSessionFromRequest(request);
  if (!session?.sub) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400 });
  }
  const { thread_id: threadId, content: rawContent, mode } = body || {};
  const content = (rawContent || '').toString().trim();
  if (!threadId || !content) {
    return new Response(JSON.stringify({ error: 'thread_id and content required' }), { status: 400 });
  }

  const stream = new ReadableStream({
    async start(controller) {
      try {
        const {
          rows: [thread],
        } = await query(
          'SELECT id, title FROM threads WHERE id = $1 AND user_id = $2',
          [threadId, session.sub]
        );
        if (!thread) {
          ndjson(controller, { type: 'error', error: 'Thread not found' });
          controller.close();
          return;
        }

        let useMode = mode === 'best' || mode === 'cheap' ? mode : null;
        if (!useMode) {
          const { rows: [u] } = await query('SELECT preferred_mode FROM users WHERE id = $1', [session.sub]);
          useMode = u?.preferred_mode === 'best' ? 'best' : 'cheap';
        }

        const {
          rows: [userMsg],
        } = await query(
          'INSERT INTO messages (thread_id, user_id, role, content) VALUES ($1, $2, $3, $4) RETURNING id, created_at',
          [threadId, session.sub, 'user', content]
        );
        if (!userMsg) {
          ndjson(controller, { type: 'error', error: 'Failed to save message' });
          controller.close();
          return;
        }

        const messageCountResult = await query(
          'SELECT COUNT(*)::int AS c FROM messages WHERE thread_id = $1 AND role = $2',
          [threadId, 'user']
        );
        const isFirstMessage = messageCountResult.rows[0]?.c === 1;
        if (isFirstMessage) {
          const title = content.slice(0, 40).trim() || 'New chat';
          await query('UPDATE threads SET title = $1, updated_at = NOW() WHERE id = $2', [title, threadId]);
        } else {
          await query('UPDATE threads SET updated_at = NOW() WHERE id = $1', [threadId]);
        }

        ndjson(controller, { type: 'start', message_id: userMsg.id, thread_id: threadId });

        const models = useMode === 'best' ? MODELS_BEST : MODELS_CHEAP;
        const messages = [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content }
        ];
        const results = [];

        const runOne = async (model) => {
          const result = await callLiteLLM(model, messages, true);
          let fullContent = '';
          let ok = true;
          let finalError = null;

          if (!result.ok) {
            ok = false;
            finalError = result.error;
          } else {
            const reader = result.stream.getReader();
            const decoder = new TextDecoder();
            let buffer = '';
            try {
              while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop() || '';
                for (const line of lines) {
                  if (line.startsWith('data: ') && line !== 'data: [DONE]') {
                    try {
                      const data = JSON.parse(line.trim().slice(6));
                      const chunk = data.choices?.[0]?.delta?.content || '';
                      if (chunk) {
                        fullContent += chunk;
                        ndjson(controller, {
                          type: 'model_chunk',
                          model,
                          chunk,
                        });
                      }
                    } catch (_) { }
                  }
                }
              }
            } catch (err) {
              ok = false;
              finalError = err.message;
            }
          }

          await query(
            `INSERT INTO model_responses (message_id, model_name, content, ok, error)
             VALUES ($1, $2, $3, $4, $5)`,
            [
              userMsg.id,
              model,
              ok ? fullContent : null,
              ok,
              finalError ? JSON.stringify(finalError) : null,
            ]
          );

          ndjson(controller, {
            type: 'model_done',
            model,
            content: ok ? fullContent : null,
            ok,
            error: finalError || null,
          });

          return { ok, content: fullContent, error: finalError };
        };

        const promises = models.map((model) => runOne(model));
        const allResults = await Promise.all(promises);
        results.push(...allResults.map((r, i) => ({ model: models[i], ...r })));

        let summaryContent = null;
        try {
          summaryContent = await callJudge(
            content,
            allResults.map((r, i) => ({ model: models[i], ok: r.ok, content: r.content, error: r.error })),
            useMode
          );
          if (summaryContent) {
            await query('INSERT INTO summaries (message_id, content) VALUES ($1, $2)', [
              userMsg.id,
              summaryContent,
            ]);
          }
        } catch (_) { }
        ndjson(controller, { type: 'summary', content: summaryContent });
        ndjson(controller, { type: 'done' });
      } catch (err) {
        ndjson(controller, { type: 'error', error: err.message || 'Failed' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

module.exports = { POST };
