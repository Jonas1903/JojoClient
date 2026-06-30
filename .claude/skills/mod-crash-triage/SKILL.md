---
name: mod-crash-triage
description: Triage Minecraft launch, Fabric startup, and mod-sync failures.
disable-model-invocation: true
context: fork
agent: launcher-engineer
argument-hint: "[symptom, log excerpt, installation, or profile]"
---

Debug this Minecraft launch or mod-sync problem:

$ARGUMENTS

Priorities:
1. Inspect `launcher.ts`, `mods.ts`, `download.ts`, and nearby IPC flows.
2. Check dependency resolution, disabled mod handling, crash recovery, and classpath or library issues.
3. Fix the smallest slice that explains the failure.
4. Summarize the root cause, the fix, and the validation run.