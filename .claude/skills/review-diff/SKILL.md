---
name: review-diff
description: Review current local changes for real risks.
disable-model-invocation: true
context: fork
agent: change-reviewer
argument-hint: "[optional file, feature, or concern]"
---

Review the current local changes at a high level.

Task focus: $ARGUMENTS

Workflow:
1. Inspect only the changed files and any files or symbols named in the task.
2. Read only the minimum extra context needed.
3. Report up to 3 material risks.
4. Ignore formatting, naming nits, and speculative refactors.

If there are no material issues, say: No high-level risks found.