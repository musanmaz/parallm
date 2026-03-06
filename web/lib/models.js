const LITELLM_BASE = (process.env.LITELLM_BASE_URL || 'http://localhost:4000').replace(/\/$/, '');
const LITELLM_KEY = process.env.LITELLM_MASTER_KEY || '';
const REQUEST_TIMEOUT_MS = 90 * 1000;

const MODELS_CHEAP = ['chatgpt_cheap', 'claude_cheap', 'grok_cheap', 'gemini_cheap'];
const MODELS_BEST = ['chatgpt_best', 'claude_best', 'grok_best', 'gemini_best'];
const JUDGE_MODEL_PRIMARY = 'claude_best';
const JUDGE_MODEL_FALLBACK = 'gemini_best';

async function callLiteLLM(model, messages, stream = false) {
  const url = `${LITELLM_BASE}/v1/chat/completions`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(LITELLM_KEY && { Authorization: `Bearer ${LITELLM_KEY}` }),
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 2048,
        ...(stream && { stream: true }),
      }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        content: null,
        error: { status: res.status, message: data.error?.message || res.statusText },
      };
    }
    if (stream) {
      return { ok: true, stream: res.body };
    }
    const data = await res.json().catch(() => ({}));
    const content = data.choices?.[0]?.message?.content ?? null;
    return { ok: true, content, error: null };
  } catch (err) {
    clearTimeout(timeoutId);
    const message = err.name === 'AbortError' ? 'Request timeout' : (err.message || 'Request failed');
    return {
      ok: false,
      content: null,
      error: { message },
    };
  }
}

async function callAllModels(messages, mode = 'cheap') {
  const models = mode === 'best' ? MODELS_BEST : MODELS_CHEAP;
  const results = await Promise.all(
    models.map(async (model) => {
      const result = await callLiteLLM(model, messages);
      return { model, ...result };
    })
  );
  return results;
}

async function callJudge(userMessage, modelResponses, mode) {
  const models = mode === 'best' ? MODELS_BEST : MODELS_CHEAP;
  const responsesText = modelResponses
    .map((r) => `### ${r.model}\n${r.ok ? r.content : `(Error: ${JSON.stringify(r.error)})`}`)
    .join('\n\n');
  const systemPrompt = 'You are a concise summarizer. Given a user question and multiple model answers, produce a single short combined summary (2-4 sentences) that captures the main points. Do not add meta-commentary.';
  const userPrompt = `User question:\n${userMessage}\n\nModel answers:\n${responsesText}\n\nCombined summary:`;
  const messages = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt },
  ];
  let result = await callLiteLLM(JUDGE_MODEL_PRIMARY, messages);
  if (!result.ok && JUDGE_MODEL_FALLBACK !== JUDGE_MODEL_PRIMARY) {
    result = await callLiteLLM(JUDGE_MODEL_FALLBACK, messages);
  }
  return result.ok ? result.content : null;
}

module.exports = {
  MODELS_CHEAP,
  MODELS_BEST,
  callLiteLLM,
  callAllModels,
  callJudge,
};
