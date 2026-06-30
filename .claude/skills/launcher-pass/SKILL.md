---
name: launcher-pass
description: Implement or fix launcher-side features in this repo.
disable-model-invocation: true
context: fork
agent: launcher-engineer
argument-hint: "[task]"
---

Implement or fix this launcher or client task:

$ARGUMENTS

Focus on:
- `electron/main.ts`
- `electron/preload.ts`
- `src/main/services/**`

Keep IPC hardened, preserve Node-safe service boundaries, and validate with the narrowest relevant checks.