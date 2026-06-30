# JojoClient - Copilot Instructions (v2.0 - Opus 4.6 Optimized)

## 🤖 Agent Session Lifecycle
Before starting any task, follow this protocol:
1. **Plan:** Outline the logic changes and ask for clarification if any "freestyling" is required. Also if something doesnt work or would be a bad Idea bring that to the users mind instead of just doing it.
2. **Execute:** Implement using the most secure and accurate patterns (Zero Trust Electron).
3. **Verify:** ALWAYS self-test by running `npx tsc -p tsconfig.json --noEmit` and `npx tsc -p tsconfig.electron.json --noEmit` and fixing all errors before reporting back. Never ask the user to test broken code.
4. **Report:** Summarize **Functional Changes Only** (e.g., "The login button now handles MFA") and provide specific instructions on how the user should test them in the running app.

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
- Microsoft/Xbox/Minecraft OAuth2 authentication with encrypted local token storage
- Vanilla + Fabric game download with SHA-1 verification
- Profile & Installation management (template/instance model)
- Mod management via Modrinth (search, download, sync, enable/disable)
- Auto-updater via electron-updater