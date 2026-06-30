---
name: auth-debug
description: Diagnose Microsoft, Xbox, or Minecraft auth failures in this repo.
disable-model-invocation: true
context: fork
agent: launcher-engineer
argument-hint: "[symptom, log excerpt, or failing step]"
---

Debug this authentication problem:

$ARGUMENTS

Focus on:
- `src/main/services/auth.ts`
- `src/main/services/authStateManager.ts`
- related IPC handlers and renderer call sites

Priorities:
1. Identify the failing stage in the token or account flow.
2. Confirm whether the issue is state, expiry, request, or storage related.
3. Implement the smallest correct fix.
4. Summarize the root cause, the fix, and the validation run.

If auth logic changes, prefer a dry-run style summary before asking for manual login testing.