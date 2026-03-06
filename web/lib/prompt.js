/**
 * System prompt injected into every LLM request as context for the judge/summary model.
 *
 * Customize this to suit your use case. The prompt is sent as the system message
 * to the judge model that summarizes multi-model responses.
 */
const SYSTEM_PROMPT = `You are a helpful AI assistant. Answer questions clearly and accurately.

When summarizing multiple AI model responses, identify the most accurate and useful answer,
highlight key differences between models, and provide a concise synthesis.`;

module.exports = { SYSTEM_PROMPT };
