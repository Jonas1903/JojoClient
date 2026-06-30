---
description: Load the frontend-design skill and prepare for UI work. MANDATORY entry point for all frontend changes.
agent: orchestrator
---
Before working on any frontend code, load the `frontend-design` skill using the `skill` tool:

```
skill: frontend-design
```

Then proceed with the task described in $ARGUMENTS.

Rules enforced by this skill:
- All CSS uses `var(--bg-*)`, `var(--text-*)`, `var(--accent*)`, `var(--radius-*)`, `var(--shadow-*)`, `var(--transition-*)` tokens
- Typography: Inter 14px body, JetBrains Mono for data identifiers only
- One accent color (green `#22C55E`). No gradients. No glows.
- Six zinc background layers only. No seventh surface.
- No bounce/spring animations. No pulse on stable states.
- No emoji icons. All icons are stroke-based SVG.
- Pre-flight validation checklist must pass before completion.
