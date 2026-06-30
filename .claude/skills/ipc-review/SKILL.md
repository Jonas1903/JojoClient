---
name: ipc-review
description: Review Electron IPC trust boundaries and preload exposure.
disable-model-invocation: true
context: fork
agent: ipc-guard
argument-hint: "[feature, file, or handler]"
---

Review the IPC and trust boundary for this task:

$ARGUMENTS

Check for:
- missing main-process validation
- over-broad preload exposure
- direct renderer access to Electron APIs
- unsafe secret, download, or filesystem handling

Return only material findings.