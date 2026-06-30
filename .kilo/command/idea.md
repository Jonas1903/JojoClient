---
description: Show or reference the JojoClient project architecture, design system, and rules from CLAUDE.md
agent: orchestrator
---
Read CLAUDE.md and present the relevant project information to the user based on $ARGUMENTS.

If $ARGUMENTS is empty:
- Show project overview (Minecraft launcher, Electron 30 + React 18 + TypeScript), architecture summary, and key rules.

If $ARGUMENTS starts with "architecture" or "ipc":
- Show the IPC bridge pattern, two TypeScript targets, service layer isolation.

If $ARGUMENTS starts with "design" or "ui":
- Show the design system summary (tokens, typography, buttons, animations).

If $ARGUMENTS starts with "data" or "storage":
- Show the data layout, profile/installation model, storage locations.

If $ARGUMENTS starts with "services":
- Show the service layer overview (12 services, their responsibilities).

If $ARGUMENTS is a specific section name:
- Read and present that specific section from CLAUDE.md.
