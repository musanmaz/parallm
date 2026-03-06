# Active Status

This file summarizes the project's **current focus** and **active decisions**.

---

## Current Status

- **Production-ready:** Login, threads, messages, 4 parallel models + judge, streaming UI, and ChatGPT-style interface are all complete.
- **Main flow:** Login → App → New chat or existing thread → Write a message → Responses appear on screen as they stream in (model blocks + summary).

---

## Active Technical Choices

1. **Routing:** Single catch-all `[[...slug]]` + ClientRouter; server only returns a loading div; all UI is client-only (no hydration risk).
2. **Message sending:** Defaults to `POST /api/messages/stream`; the older one-shot `POST /api/messages` still exists but ChatView uses stream.
3. **Mode:** User preference `preferred_mode` (cheap/best) is stored and retrieved via GET/PATCH `/api/auth/me`; toggled in ChatView with "Mode: Cheap / Best".

---

## Known Limitations / Notes

- **If a model doesn't respond:** Check LiteLLM logs and ensure the corresponding API key is set in `.env`; model names must match those defined in `litellm/config.yaml`.
- **Migrations:** Both `db/migrations/` and `web/db/migrations/` exist; the Docker image uses `web/db/migrations` with `run-migrations.js` — keep them in sync.
- **Rate limiter:** `web/lib/rateLimit.js` is in-memory; not shared across multiple instances.

---

## No Outstanding Tasks

All previously requested features (ChatGPT-style UI, streaming, correct OpenAI model names, configurable users, register disabled, port 3005, hydration fix) have been implemented. This file serves as a "current state" reference until new feature requests arrive.
