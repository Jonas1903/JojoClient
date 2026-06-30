---
name: summarize-changes
description: Summarize the current working tree for handoff or commit prep.
disable-model-invocation: true
context: fork
agent: change-reviewer
argument-hint: "[optional focus]"
---

Summarize the current local changes.

Task focus: $ARGUMENTS

Return:
- a 3 to 6 bullet summary of what changed
- a short watchlist section only if meaningful risk remains
- one suggested commit message at the end