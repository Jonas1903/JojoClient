---
name: frontend-pass
description: Implement or fix renderer and web UI work in this repo.
disable-model-invocation: true
context: fork
agent: frontend-builder
argument-hint: "[task]"
---

Implement or fix this frontend task:

$ARGUMENTS

Focus on renderer files first:
- `src/App.tsx`
- `src/App.css`
- `src/index.css`
- `index.html`

Preserve the current visual language unless the task explicitly asks for a redesign.
After edits, run the narrowest relevant validation, starting with `npx tsc -p tsconfig.json --noEmit`.