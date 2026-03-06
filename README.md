# Multi-LLM Web

A Next.js (App Router) multi-model chat application. Every message is sent to **4 LLM models in parallel** via a LiteLLM proxy; a judge model then generates a summary. Users log in with a username and password; threads and messages are stored in PostgreSQL.

## Requirements

- Node.js 18+
- Docker & Docker Compose (optional; for local Postgres + LiteLLM)
- PostgreSQL 14+ (or the `postgres` service in Docker)

## Environment Variables

Create a `.env` file in the **project root** (same directory as `docker-compose.yml`). Do **not** commit this file to version control. Use `.env.example` as a template.

| Variable | Service | Description |
|----------|---------|-------------|
| `OPENAI_API_KEY` | LiteLLM | OpenAI API key |
| `ANTHROPIC_API_KEY` | LiteLLM | Anthropic API key |
| `XAI_API_KEY` | LiteLLM | xAI (Grok) API key |
| `GEMINI_API_KEY` | LiteLLM | Google Gemini API key |
| `LITELLM_MASTER_KEY` | LiteLLM + Web | Master key for proxy and web requests |
| `JWT_SECRET` | Web | Secret for session JWT signing (min 32 chars) |
| `INITIAL_PASSWORD` | Web (seed) | Initial password for seeded users (min 6 chars) |
| `SEED_USERS` | Web (seed) | Comma-separated usernames to seed (default: `user1,user2`) |
| `COOKIE_NAME` | Web | Optional; default: `multi_llm_session` |
| `COOKIE_MAX_AGE_SECONDS` | Web | Optional; default: `604800` (7 days) |

By default the app has no registration page; initial users are created via a seed script using `INITIAL_PASSWORD`. You can configure which users to create via `SEED_USERS`.

The Docker Compose file passes this `.env` to the `litellm` service (`env_file: .env`). The model list is defined in `litellm/config.yaml`. See `.env.example` in the project root for a template.

## Database Migrations

Run migrations to create the schema on first setup.

**Option 1 - From repo root (Postgres must be running):**

```bash
cd web
export DATABASE_URL="postgres://multi_llm:multi_llm_secret@localhost:5432/multi_llm"
npm run migrate
```

**Option 2 - Inside Docker:**

```bash
docker compose exec web node scripts/run-migrations.js
```

**Option 3 - Directly with psql:**

```bash
psql "$DATABASE_URL" -f db/migrations/001_initial.sql
psql "$DATABASE_URL" -f db/migrations/002_username.sql
```

**Seed users:** After migrations, with `INITIAL_PASSWORD` set in `.env`:

```bash
cd web && npm run seed
# or Docker: docker compose exec web node scripts/seed-users.js
```

To create custom users, set `SEED_USERS=alice,bob` before running the seed.

## Running Locally (without Docker)

1. Start PostgreSQL and create a database.
2. Create `web/.env` and set `DATABASE_URL` and other required variables.
3. Run migrations: `cd web && npm run migrate`
4. Start the LiteLLM proxy in a separate terminal (port 4000).
5. Start Next.js:

```bash
cd web
npm install
npm run dev
```

The app will be available at http://localhost:3005.

## Running with Docker

All services (Postgres, LiteLLM, web) are started via Docker Compose:

```bash
# Ensure .env exists in the root with API keys + LITELLM_MASTER_KEY + JWT_SECRET
docker compose up -d --build
```

After the first run, apply migrations and seed users:

```bash
docker compose exec web node scripts/run-migrations.js
docker compose exec web node scripts/seed-users.js
```

`INITIAL_PASSWORD` must be set in `.env`.

- Web: http://localhost:3005
- LiteLLM: http://localhost:4000
- Postgres: localhost:5432 (user/password: `multi_llm` / `multi_llm_secret`)

## Test Checklist

- [ ] **Login:** `/login` + `INITIAL_PASSWORD` -> redirected to `/app`
- [ ] **Session:** Closing and reopening the browser still shows the user as logged in (within 7 days)
- [ ] **Logout:** Logout button -> cookie cleared, redirected to `/login`
- [ ] **New chat:** "+ New chat" -> empty main area, message can be sent from composer
- [ ] **First message:** Send a message -> new thread is created, `?thread=...` appears in URL, thread appears in sidebar
- [ ] **4 models:** After sending, 4 model cards and (if available) a summary block appear
- [ ] **Mode:** Toggle "Mode: Cheap" / "Mode: Best" switches between cheap/best model sets; preference is saved (PATCH /api/auth/me)
- [ ] **Thread selection:** Clicking another thread in the sidebar loads its message history
- [ ] **Protection:** Accessing `/app` or `/api/threads` without logging in returns 401 or redirects to `/login`
- [ ] **Rate limit:** Too many login requests return 429 (optional test)

## Files Created / Modified

- `docker-compose.yml` - litellm, postgres, web services
- `db/migrations/001_initial.sql` - users, threads, messages, model_responses, summaries
- `web/package.json` - next, pg, bcryptjs, jose, migrate script
- `web/next.config.js` - standalone output
- `web/Dockerfile` - multi-stage build
- `web/jsconfig.json` - `@/*` path alias
- `web/.env.example` - example environment variables
- `web/lib/db.js` - Postgres pool
- `web/lib/auth.js` - JWT + cookie helpers
- `web/lib/models.js` - LiteLLM calls, cheap/best, judge
- `web/lib/rateLimit.js` - simple in-memory rate limiter
- `web/lib/prompt.js` - system prompt for LLM requests (customize as needed)
- `web/scripts/run-migrations.js` - migration runner
- `web/middleware.js` - session guard; /login and /register are public
- `web/app/components/LoginView.js` - login form
- `web/app/components/ChatView.js` - streaming message list and composer
- `web/app/app/AppShell.js` - sidebar, thread list, mode toggle, logout
- `web/app/api/auth/login/route.js`
- `web/app/api/auth/register/route.js`
- `web/app/api/auth/logout/route.js`
- `web/app/api/auth/me/route.js` (GET + PATCH preferred_mode)
- `web/app/api/threads/route.js` (GET, POST)
- `web/app/api/threads/[threadId]/route.js` (GET, DELETE)
- `web/app/api/messages/route.js` (POST - 4 models + judge summary, writes to DB)
- `web/app/api/messages/stream/route.js` (POST - NDJSON streaming endpoint)

The old Basic Auth middleware was removed and replaced with cookie-based session management.
