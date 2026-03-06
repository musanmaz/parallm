# Memory Bank

This directory centralizes the context, architecture, decisions, and implementation history of the **local-llm** project. A new developer or AI assistant can quickly understand the project by reading these files.

## Files

| File | Contents |
|------|----------|
| **CONTEXT.md** | What the project is, goals, constraints, target users, key env variables |
| **ARCHITECTURE.md** | Tech stack, directory structure, data flow, DB schema, LiteLLM models, UI flow |
| **DECISIONS.md** | Key decisions made (register disabled, port 3005, client-only rendering, streaming, ChatGPT-style UI, etc.) |
| **ACTIVE.md** | Current focus, active technical choices, known limitations |
| **IMPLEMENTATION.md** | Chronological/topic-based summary of work done, file-by-file change list |

## Usage

- First time in the project? Read: **CONTEXT** → **ARCHITECTURE** → **DECISIONS** in order.
- Asking "why was this done this way?" → **DECISIONS.md**.
- Asking "what's the current status?" → **ACTIVE.md**.
- Asking "what was done, which files changed?" → **IMPLEMENTATION.md**.

Update these files as the project evolves to keep the memory-bank current.
