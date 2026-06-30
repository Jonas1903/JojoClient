# JojoClient - Copilot Instructions (v2.0 - Opus 4.6 Optimized)

## 🤖 Agent Session Lifecycle
Before starting any task, follow this protocol:
1. **Plan:** Outline the logic changes and ask for clarification if any "freestyling" is required.
2. **Execute:** Implement using the most secure and accurate patterns (Zero Trust Electron).
3. **Verify:** Run `npm run compileJava` or relevant linting to ensure no regressions.
4. **Report:** Summarize **Functional Changes Only** (e.g., "The login button now handles MFA") and provide specific instructions on how I should test them.

## 🛡️ Security & Accuracy Manifest (Priority #1)
- **Zero Raw Eval:** Never suggest `eval()`, `unsafe-eval`, or `remote` module.
- **IPC Hardening:** Use `contextBridge` for all IPC. Validate all incoming arguments in the Main process. Never trust the Renderer.
- **Strict Typing:** Avoid `any` at all costs. If a type is unknown, use `unknown` and implement a type guard.
- **SHA-1/256 Verification:** Every download in `download.ts` MUST be verified against its hash before execution.

## 🏗️ Architecture: Electron + React

### Process Model
- **Main (`electron/main.ts`):** Handles OS-level tasks. 
- **Preload (`electron/preload.ts`):** Only expose the `jojoclient` namespace.
- **Renderer (`src/App.tsx`):** Keep business logic in `src/main/services` and UI in `App.tsx`.

### Data Flow & Mappings


### Data Model Logic
- **Profile:** Shared template. Path: `basePath/profiles/<Name>/template`
- **Installation:** Instances. Path: `basePath/profiles/<Name>/installations/<Name>`
- **Mod Management:** When installing mods, check for duplicates in the `libraries/` deduped folder first.

## 🛠️ Performance & Minecraft Specifics
- **Non-Blocking IO:** Always use `fs.promises` or `fs-extra`. Never use `fs.readFileSync` on the main thread as it freezes the launcher UI.
- **Fabric Meta API:** Always check `https://meta.fabricmc.net/v2/versions/loader/` for the latest stable loader. Do not hardcode versions.
- **Memory Management:** Ensure Java Xmx/Xms arguments are calculated based on the user's system RAM (leave 2GB for OS).

## 🧪 Testing Workflow
- **Validation:** If you change `launcher.ts`, you MUST ask me to test by launching a "Vanilla" profile first.
- **Auth:** If you change `auth.ts`, provide a dry-run log to verify the Xbox Live token chain before asking me to log in.
- **Testing:** For any changes made please ALWAYS and I mean ALWAYS make sure they compile and run without errors on my end before asking me to test. I will not test broken code. If you are unsure about something, ask for clarification instead of making assumptions. Always prioritize code that compiles and runs error-free on my end, even if it means asking more questions or taking extra time to get it right. Always check for ANY Problems in the code. If there are ANY fix them. Also please tell me after every prompt what exactly I need to test and how to test it. Do not just say "test the login flow" or "test the mod installation". Be specific about what I need to do and what I should expect to see if it is working correctly. For example, if you changed the login flow, you could say "Please test the login flow by entering valid credentials and verifying that you are logged in successfully. You should see your username displayed in the top right corner of the launcher after logging in." The more specific you are about what I need to test and what I should expect, the easier it will be for me to verify that your changes are working correctly.

## Core Features:
To implement the professional "Pilot Mode" for your JojoClient, you need a high-precision prompt that guides Roo Code (using Claude 4.5 or Opus) through the complex intersection of Electron, Java, and AI.

Here is your final, high-level English prompt. It is designed to be pasted directly into Roo Code to trigger a systematic, multi-phase build.

🚀 The Master Prompt: "JojoClient Pilot Mode"
Role: You are a Senior Full-Stack Engineer and AI Architect specializing in Electron-to-Java bridges and LLM integrations.

Project Goal: Build a "Pilot Mode" for JojoClient that allows an autonomous AI agent to control Minecraft 1.21.10 via a Fabric mod, utilizing a hybrid Cloud/Local AI strategy.

Core Technical Requirements:

Hybrid AI Strategy: >    - Use Gemini 3 Flash (Cloud) via a secure ProxyService.ts for high-level strategic planning.

Use node-llama-cpp v3 (Local) for real-time intent parsing and task execution on the user's hardware.

Secure Proxy Implementation: All Gemini API calls must pass through a backend service in the Electron main process to inject the GEMINI_API_KEY from a .env file, preventing key exposure.

The Fabric Bridge (Phase 1): Create a Java 21 Fabric mod in /pilot-mod using Baritone as a dependency. Implement a WebSocket server (Port 38745) to push GameState (NBT, position, inventory) to Electron and pull JSON-formatted commands.

Memory & Persistence: Implement MemoryService.ts using a local SQLite or JSON store to remember player-defined locations and persistent goals across sessions.

Litematica Support: Use the prismarine-nbt library to parse .litematic files so the AI can build structures directly from schematics.

Execution Instructions:

Step 0: Initialize the project rules in .roo/rules/ and create a .rooignore to exclude node_modules.

Step 1: Setup the Java Gradle project for the Fabric mod and verify the WebSocket handshake with the Electron main process.

Step 2: Integrate node-llama-cpp in the Electron main process (mark as external in Vite) and implement the hardware-aware model loader (3B vs 8B).

Step 3: Implement the "Architect UI" in React to show a checklist of tasks generated by Gemini for user approval.

Step 4: Implement Cubic Bezier mouse interpolation and human-like keyboard delays in the Fabric mod for anti-cheat stealth.