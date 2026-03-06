# Implementation Log

This file contains a chronological, topic-based summary of work done in the project.

---

## 1. Project Scaffolding & Infrastructure

- **Docker Compose:** `litellm` (port 4000), `postgres` (5432), `web` (3005:3000) services defined.
- **LiteLLM config:** `litellm/config.yaml` — OpenAI (gpt-4o-mini, gpt-4o), Anthropic, xAI (Grok), Gemini models mapped.
- **Next.js:** App Router, `web/next.config.js` (standalone), `web/jsconfig.json` (`@/` path alias).
- **Database:** PostgreSQL; `db/migrations/001_initial.sql` (users, threads, messages, model_responses, summaries), `002_username.sql` (adds username column).
- **Web migrations:** `web/db/migrations/` (run by run-migrations.js), `web/scripts/run-migrations.js`.
- **Seed:** `web/scripts/seed-users.js` — creates users from `SEED_USERS` env var using `INITIAL_PASSWORD`; `ON CONFLICT (username) DO UPDATE` to re-seed safely.

---

## 2. Authentication

- **JWT + Cookie:** `web/lib/auth.js` — SignJWT/jwtVerify via jose; HttpOnly cookie (COOKIE_NAME, COOKIE_MAX_AGE); `getSessionFromRequest(req)`.
- **Login:** `POST /api/auth/login` — username + password; bcrypt compare; JWT created and cookie set; rate limiting applied (rateLimit.js).
- **Logout:** `POST /api/auth/logout` — cookie cleared.
- **Me:** `GET /api/auth/me` — reads session from cookie; returns user info and preferred_mode. `PATCH /api/auth/me` — updates preferred_mode (cheap/best).
- **Register:** API route exists but is not used; middleware redirects `/register` → `/login`.
- **Middleware:** `web/middleware.js` — redirects to `/login` on protected paths if no cookie; `/login` is public; `/` → `/app`.

---

## 3. Thread & Message APIs

- **Threads:** `GET /api/threads` — user's thread list; `POST /api/threads` — create new thread (title optional).
- **Thread detail:** `GET /api/threads/[threadId]` — thread + messages (with model_responses and summary). `DELETE` — delete thread.
- **Message (one-shot):** `POST /api/messages` — thread_id, content, mode; user message written; 4 models called in parallel (callAllModels); judge (callJudge); model_responses and summary written to DB. ChatView now uses the stream endpoint instead.

---

## 4. LiteLLM Integration

- **web/lib/models.js:** `callLiteLLM(model, messages)` — calls LiteLLM `/v1/chat/completions`; 90s timeout. `callAllModels(messages, mode)` — parallel calls with the cheap or best model list. `callJudge(userMessage, modelResponses, mode)` — converts all responses to text and requests a summary; tries claude_best first, then gemini_best.
- **Model lists:** MODELS_CHEAP, MODELS_BEST (chatgpt, claude, grok, gemini).

---

## 5. Hydration Fix: Client-Only Rendering

- **Problem:** useSearchParams, server/client mismatch, "Only one root element" React hydration errors.
- **Attempts:** Removed useSearchParams; used `window.location` + useEffect; disabled Strict Mode; suppressHydrationWarning; ClientRoot with dynamic(ssr: false).
- **Final solution:** All routes consolidated into a single **catch-all** page: `app/[[...slug]]/page.js` renders only `<ClientRouter />`. The server always returns the same minimal "Loading…" content; the real UI (LoginView, AppShell, ChatView) is only mounted on the client after hydration. ClientRouter manages the path via `window.location.pathname` and `popstate` / `route-change` events, eliminating server/client HTML mismatch.

---

## 6. Streaming Message API & Progressive UI

- **New endpoint:** `POST /api/messages/stream` — body: thread_id, content, mode. Response: NDJSON stream (application/x-ndjson).
  - Flow: Thread and user message written to DB; title updated on first message.
  - `start` event (message_id) emitted.
  - 4 models called in parallel; each model on completion inserts to model_responses, then emits a `model` event (model, content, ok, error).
  - After all models finish, judge is called; summary written to DB; `summary` event; then `done`. On error: `error` event.
- **ChatView update:** On send, a user bubble and a temporary "response" card (streaming state) are added immediately. `/api/messages/stream` is fetched; `response.body` ReadableStream is read line by line; each NDJSON line is parsed and updates state. Model responses and summary appear in the same message block in real time; "Responses loading…" is visible until at least one payload arrives.

---

## 7. ChatGPT-Style Interface

- **ChatView redesign:** Small grid boxes removed; single centered chat column (max-width 48rem), dark background.
- **Message layout:** User messages right-aligned as bubbles; assistant responses left-aligned inside a single card (green-bordered summary block first, then one section per model with name + content/error). Composer at the bottom with a rounded input and Send button.
- **AppShell:** Sidebar with thread list; header with mode toggle (Cheap / Best) and logout; synced with ChatView via refresh-threads and thread-nav events.

---

## 8. Other Fixes

- **OpenAI model names:** `litellm/config.yaml` updated to use gpt-4o-mini and gpt-4o (real API names).
- **AppShell auth fix:** `meRes.json()` was called twice (consuming the body); fixed to parse once and check `meData.user`.

---

## File-Level Summary (Created / Key Changes)

| File | Description |
|------|-------------|
| `docker-compose.yml` | litellm, postgres, web; env_file .env; web 3005:3000 |
| `litellm/config.yaml` | All model mappings; OpenAI gpt-4o-mini / gpt-4o |
| `db/migrations/001_initial.sql` | users, threads, messages, model_responses, summaries |
| `db/migrations/002_username.sql` | users.username column |
| `web/lib/db.js` | pg Pool, query() |
| `web/lib/auth.js` | JWT, cookie, getSessionFromRequest |
| `web/lib/models.js` | callLiteLLM, callAllModels, callJudge |
| `web/lib/rateLimit.js` | Login/register rate limiter |
| `web/middleware.js` | Cookie-based protection; /login public; /register → /login |
| `web/app/[[...slug]]/page.js` | Catch-all; ClientRouter |
| `web/app/ClientRouter.js` | path → LoginView / AppShell+ChatView; dynamic ssr:false |
| `web/app/components/LoginView.js` | Login form |
| `web/app/components/ChatView.js` | Stream-based message list, composer, ChatGPT-style UI |
| `web/app/app/AppShell.js` | Sidebar, thread list, mode toggle, logout; meRes.json single-read fix |
| `web/app/api/auth/*` | login, logout, me (GET+PATCH), register |
| `web/app/api/threads/route.js` | GET, POST |
| `web/app/api/threads/[threadId]/route.js` | GET, DELETE |
| `web/app/api/messages/route.js` | POST (one-shot 4 models + judge) |
| `web/app/api/messages/stream/route.js` | POST NDJSON stream; model/summary events |
| `web/scripts/run-migrations.js` | Runs db/migrations SQL files |
| `web/scripts/seed-users.js` | Creates users from SEED_USERS + INITIAL_PASSWORD |

This summary, together with the other memory-bank files (CONTEXT, ARCHITECTURE, DECISIONS, ACTIVE), documents what the project does and how it works.
