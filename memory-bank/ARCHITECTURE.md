# Architecture

## Tech Stack

- **Frontend:** Next.js 14+ (App Router), React, client-only page rendering
- **Backend:** Next.js API Routes (Node.js), CommonJS (`require`)
- **Database:** PostgreSQL 16 (Docker: `postgres` service)
- **LLM proxy:** LiteLLM (Docker: `litellm`, port 4000)
- **Auth:** JWT (jose), HttpOnly cookie, bcryptjs (password hashing)
- **Deployment:** Docker Compose (litellm, postgres, web); web port 3005

## Directory Structure (Summary)

```
local-llm/
├── .env                    # API keys, JWT_SECRET, INITIAL_PASSWORD (not committed to git)
├── .env.example            # Template with placeholder values
├── docker-compose.yml      # litellm, postgres, web
├── litellm/
│   └── config.yaml         # Model list (chatgpt_cheap/best, claude_*, grok_*, gemini_*)
├── db/migrations/          # 001_initial.sql, 002_username.sql (keep in sync with web/db/migrations)
├── memory-bank/            # This documentation
└── web/
    ├── app/
    │   ├── [[...slug]]/page.js   # Single catch-all; renders ClientRouter
    │   ├── ClientRouter.js       # Routes by path → LoginView / AppShell+ChatView
    │   ├── layout.js, globals.css, not-found.js
    │   ├── app/
    │   │   └── AppShell.js       # Sidebar (thread list) + children (ChatView)
    │   ├── components/
    │   │   ├── LoginView.js
    │   │   └── ChatView.js       # Message list, composer, streaming UI
    │   └── api/
    │       ├── auth/login, logout, me (GET+PATCH), register
    │       ├── threads (GET, POST), threads/[threadId] (GET, DELETE)
    │       ├── messages/route.js         # POST: all 4 models + judge in one shot
    │       └── messages/stream/route.js  # POST: NDJSON stream; events per model/summary
    ├── lib/
    │   ├── auth.js         # JWT, cookie, getSessionFromRequest
    │   ├── db.js           # pg Pool, query()
    │   ├── models.js       # callLiteLLM, callAllModels, callJudge; MODELS_CHEAP/BEST
    │   └── rateLimit.js    # Login/register rate limiter
    ├── db/migrations/      # SQL files run by run-migrations.js
    ├── scripts/
    │   ├── run-migrations.js
    │   └── seed-users.js   # Creates users from SEED_USERS + INITIAL_PASSWORD
    ├── middleware.js        # Cookie-based protection; /login is public; /register → /login
    └── next.config.js      # standalone output (for Docker)
```

## Data Flow

1. **Login:** `POST /api/auth/login` (username + password) → JWT created, HttpOnly cookie set → `/app`.
2. **Thread list:** `GET /api/threads` → user's threads; displayed in AppShell sidebar.
3. **Sending a message (streaming):** `POST /api/messages/stream` (thread_id, content, mode) → NDJSON stream:
   - `start` → message_id
   - Per model on completion: `model` (model, content, ok, error)
   - After judge: `summary` (content)
   - `done` or on failure: `error`
4. **Thread detail:** `GET /api/threads/[threadId]` → thread + messages (with model_responses and summary).

## Database Schema (Summary)

- **users:** id, username, email, password_hash, preferred_mode (cheap/best)
- **threads:** id, user_id, title, created_at, updated_at
- **messages:** id, thread_id, user_id, role (user/assistant), content
- **model_responses:** message_id, model_name, content, ok, error (JSONB)
- **summaries:** message_id, content (one summary per user message)

## LiteLLM Model Mapping

- **chatgpt_cheap** → openai/gpt-4o-mini  
- **chatgpt_best** → openai/gpt-4o  
- **claude_cheap** → anthropic/claude-haiku-4-5  
- **claude_best** → anthropic/claude-sonnet-4-6  
- **grok_cheap / grok_best** → xAI models  
- **gemini_cheap / gemini_best** → Gemini models  

Full list in `litellm/config.yaml`. Judge uses `claude_best` first, falling back to `gemini_best` (`web/lib/models.js`).

## UI Flow

- **Routing:** All navigation is client-side (ClientRouter). The server always returns the same catch-all page; `window.location.pathname` + `popstate` / `route-change` events handle path updates.
- **App:** `/app` → AppShell (sidebar + ChatView). Sidebar shows thread list; "+ New chat" or selecting a thread loads the thread id and messages in ChatView.
- **ChatView:** When a message is sent, a user bubble and a "Responses loading…" area are immediately added; `/api/messages/stream` NDJSON is read; each `model` and `summary` event updates state; responses appear progressively as they stream in.
