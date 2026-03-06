# Decisions

This file summarizes the key technical and product decisions made in the project.

---

## 1. No Registration — Configurable Seed Users

- **Decision:** No public registration page. Initial users are created via a seed script. Usernames are configured via the `SEED_USERS` environment variable (comma-separated); defaults to `user1,user2`.
- **Rationale:** Keeps the system simple for internal/controlled deployments without a full user management system.
- **Implementation:** `/register` is redirected to `/login` in middleware. The register API route exists but is not used in the UI. Seed: `web/scripts/seed-users.js`.

---

## 2. Port 3005

- **Decision:** The app runs on **port 3005** instead of 3000.
- **Implementation:** Docker maps `3005:3000`; for local `npm run dev`, adjust `package.json` scripts or next.config if needed.

---

## 3. Hydration Fix: Client-Only Page

- **Problem:** `useSearchParams`, server/client mismatch, and "Only one root element" React hydration errors (#418, #423).
- **Decision:** Render all page UI **client-only**. The server always returns a single minimal "Loading…" div; the real content (LoginView, AppShell, ChatView) only mounts on the client.
- **Implementation:**
  - All routes are unified under a single **catch-all**: `app/[[...slug]]/page.js` renders only `<ClientRouter />`.
  - `ClientRouter` manages the path via `window.location.pathname` and `popstate` / `route-change` events; `/login` → LoginView, `/app` → AppShell + ChatView.
  - LoginView, ChatView, AppShell are loaded with `dynamic(..., { ssr: false })`.
  - This eliminates server/client HTML mismatch (hydration errors).

---

## 4. Streaming (Progressive) Message Display

- **Decision:** Instead of waiting for all responses before rendering, responses are displayed **as they arrive** (each model on completion, then the summary).
- **Implementation:**
  - **Backend:** `POST /api/messages/stream` — NDJSON stream. User message written to DB; 4 models called in parallel; each model's result is streamed as `{ type: 'model', ... }`; after judge: `{ type: 'summary', ... }`, then `{ type: 'done' }`.
  - **Frontend (ChatView):** On send, a user bubble and a temporary "response" card (streaming state) are added immediately. `/api/messages/stream` is fetched; `response.body` ReadableStream is read line by line; each NDJSON line updates state. Model responses and summary appear in the same message block in real time; "Responses loading…" text is visible until at least one payload arrives.

---

## 5. ChatGPT-Style Interface

- **Decision:** Replace small grid boxes with a single fluid chat column; messages in a single column with large readable blocks; summary + model responses in one "answer" area as vertical sections instead of a grid.
- **Implementation:** ChatView redesigned: centered column (max-width 48rem), dark theme, user messages on the right as bubbles, assistant responses on the left inside a single card (green-bordered summary block, then one section per model).

---

## 6. Correct OpenAI Model Names

- **Decision:** OpenAI models in LiteLLM config must use actual API-compatible names (not hypothetical names).
- **Implementation:** `litellm/config.yaml`: `chatgpt_cheap` → `openai/gpt-4o-mini`, `chatgpt_best` → `openai/gpt-4o`.

---

## 7. Auth: JWT + HttpOnly Cookie

- **Decision:** Removed Basic Auth; sessions managed with JWT + HttpOnly cookie.
- **Implementation:** `web/lib/auth.js` (SignJWT/jwtVerify via jose); login route sets cookie; middleware checks cookie presence; API routes use `getSessionFromRequest()` to identify the current user.

---

## 8. CommonJS in API Routes

- **Decision:** API routes use `require()` and `module.exports` (not ESM).
- **Implementation:** All `web/app/api/**/route.js` and `web/lib/*.js` files use CommonJS; Next.js App Router supports this format.
