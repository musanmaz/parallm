# Project Context

## What Is This Project?

**local-llm (Multi-LLM Web)** — A production-ready chat application built with Next.js App Router. Users log in with a username and password, open conversations (threads), and every message is sent to **4 LLM models in parallel**. Responses are summarized by a "judge" model. Data is stored in PostgreSQL; LLM calls are routed through a LiteLLM proxy.

## Goals

- See responses from multiple models (ChatGPT, Claude, Grok, Gemini) in a single interface
- Per-user persistent thread and message history
- Cheap / Best mode selection (two sets of models)
- Fluid, ChatGPT-style UI with **streaming / progressive** display of responses as they arrive

## Constraints & Rules

- **No registration page:** Initial users are created via a seed script using `INITIAL_PASSWORD`. The list of usernames is configured via `SEED_USERS` (defaults to `user1,user2`).
- **Port:** The web app runs on **3005** (Docker: `3005:3000` mapping).
- **Auth:** JWT + HttpOnly cookie; no Basic Auth.
- **Hydration:** A mismatch between Next.js SSR and client state occurred; the fix is to render all page UI **client-only** (single catch-all route + ClientRouter). The server only returns a "Loading…" placeholder.

## Target Users

Developers / internal use. Any number of users can be seeded via `SEED_USERS`.

## Important Environment Variables

| Variable | Description |
|----------|-------------|
| `INITIAL_PASSWORD` | Password for seeded users (min 6 chars) |
| `SEED_USERS` | Comma-separated usernames to seed (default: `user1,user2`) |
| `JWT_SECRET` | Session JWT secret (min 32 chars) |
| `DATABASE_URL` | Postgres connection string |
| `LITELLM_BASE_URL` | LiteLLM proxy URL (e.g. http://localhost:4000) |
| `LITELLM_MASTER_KEY` | LiteLLM master key (optional) |
| `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, etc. | Passed to LiteLLM; models defined in config |

See the project root `README.md` and `.env.example` for details.
