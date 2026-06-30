---
name: validate-project
description: Run the repo's required validation commands.
disable-model-invocation: true
context: fork
agent: verification-runner
argument-hint: "[optional scope: typecheck, test, lint, build]"
---

Validate this repository.

Default validation:
1. `npx tsc -p tsconfig.json --noEmit`
2. `npx tsc -p tsconfig.electron.json --noEmit`

If the task explicitly asks for more, choose the smallest relevant extra command among:
- `npm run test`
- `npm run lint`
- `npm run build`

Summarize only failing commands or meaningful warnings. If everything passes, say so briefly.