---
description: Show the JojoClient design system (colors, typography, spacing, animations) from CLAUDE.md
agent: orchestrator
---
Read CLAUDE.md §UI Design System and present the relevant design tokens for $ARGUMENTS.

If $ARGUMENTS is empty:
- Show a summary of the design system: background layers (6 zinc), text levels (4), accent (green), radii, spacing scale, typography, button variants, animations.

If $ARGUMENTS is a category (colors, typography, spacing, radius, shadows, buttons, animations, layout):
- Show only that category's tokens with values and usage context.

If $ARGUMENTS is a specific token name:
- Show the exact token value and its role/usage context from the `:root` block in `src/App.css`.
