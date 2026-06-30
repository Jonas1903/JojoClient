---
name: release-checklist
description: Run a release-oriented verification pass for this repo.
disable-model-invocation: true
context: fork
agent: verification-runner
argument-hint: "[optional scope]"
---

Run a release-oriented validation pass.

Task scope: $ARGUMENTS

Default order:
1. `npx tsc -p tsconfig.json --noEmit`
2. `npx tsc -p tsconfig.electron.json --noEmit`
3. `npm run test`
4. `npm run build` only when the task or scope calls for packaging-level validation

Keep the summary short and focus on blockers.