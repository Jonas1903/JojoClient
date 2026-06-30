---
description: Summarize recent project progress and verify TypeScript targets pass
agent: orchestrator
---
Review recent changes and verify the project is in a healthy state.

$ARGUMENTS

1. Check git status for recent changes.
2. Run both TypeScript checks:
   - `npx tsc -p tsconfig.json --noEmit`
   - `npx tsc -p tsconfig.electron.json --noEmit`
3. Summarize the current state of the project.

If $ARGUMENTS provides a summary, use it as context for what was recently accomplished.
