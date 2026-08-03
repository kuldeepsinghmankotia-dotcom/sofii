# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sofii is a local-first Electron desktop AI assistant (React + TypeScript, built with `electron-vite`), single-user with no accounts/auth/hosted backend. Conversations and messages persist locally in SQLite. The renderer sends chat messages to the main process over IPC; the main process persists them, streams a reply from Groq's OpenAI-compatible chat completions API (`llama-3.3-70b-versatile`), and pushes tokens back to the renderer as they arrive. Push-to-talk voice input (Groq-hosted Whisper) and local text-to-speech (Web Speech Synthesis) are also implemented — see Architecture below.

This app is being built incrementally against a much larger long-term product vision (long-term memory/knowledge graph, automation/agents, etc. — see prior planning discussions). Later phases are not yet built and should follow the same local-first, free/open-source-first, no-auth approach unless explicitly reconsidered.

## Commands

```bash
npm run dev              # Run app in development (electron-vite dev)
npm start                 # Preview a built app (electron-vite preview)
npm run build             # Typecheck (node + web) then build with electron-vite
npm run typecheck         # Both typecheck:node and typecheck:web
npm run typecheck:node    # tsc --noEmit against tsconfig.node.json (main/preload)
npm run typecheck:web     # tsc --noEmit against tsconfig.web.json (renderer)
npm run lint               # eslint --cache .
npm run format             # prettier --write .
npm run test               # vitest run (unit tests, currently src/main/services/*.test.ts)
npm run test:watch         # vitest in watch mode
npm run build:mac          # electron-vite build + electron-builder --mac
npm run build:win          # npm run build + electron-builder --win
npm run build:linux        # npm run build + electron-builder --linux
```

## Architecture

Standard three-process Electron layout wired together with `electron-vite`, with main-process code organized by responsibility:

```
src/main/
  index.ts        # app/BrowserWindow lifecycle only — no business logic
  lib/            # cross-cutting helpers (no business logic)
    env.ts        #   dotenv loading wrapper (loadEnv())
    logger.ts     #   electron-log scoped logger (writes to OS log dir + console)
  services/       # framework-agnostic business logic (electron-import-free except app.getPath)
    db.ts         #   SofiiDb class: better-sqlite3 conversations/messages CRUD + schema init
    db.test.ts    #   Vitest tests for db.ts, using in-memory (:memory:) SQLite
    groqClient.ts #   lazily-constructed Groq/OpenAI SDK client (see note below)
  ipc/            # ipcMain handlers only — translate IPC <-> services, no business logic
    chat.ts       #   chat:* channels: conversation CRUD + streaming send-message
    voice.ts      #   voice:transcribe channel: Groq-hosted Whisper transcription
src/preload/
  index.ts        # contextBridge surface, thin — implements SofiiElectronAPI
  index.d.ts      # declares global window.electron: SofiiElectronAPI
  api.ts          # SofiiElectronAPI interface + shared types (Conversation, ChatMessage, StreamEvent, ...) — single source of truth for the renderer-visible API surface
src/renderer/src/
  App.tsx                      # shell: selected conversation state + layout
  components/ConversationList.tsx  # sidebar: list/select/create/delete conversations
  components/ChatWindow.tsx        # message list + composer for the selected conversation
```

Convention when adding new main-process subsystems (voice, memory, etc. in later phases): follow this same `lib/` (helpers) / `services/` (logic, unit-testable, no Electron-specific imports beyond `app.getPath`) / `ipc/` (thin handler registration) split rather than growing `index.ts` or inlining logic into IPC handlers.

**IPC contract** (`chat:*`, registered by `registerChatIpc()` in `src/main/ipc/chat.ts`):

- `chat:create-conversation`, `chat:list-conversations`, `chat:get-conversation`, `chat:rename-conversation`, `chat:delete-conversation` — plain invoke/return.
- `chat:send-message(conversationId, content)` — persists the user message immediately and returns `{ messageId, streamId }` right away; the assistant's reply streams separately over a dynamic per-turn channel `chat:stream:${streamId}` (events: `{type:'chunk', delta}`, `{type:'done', fullContent}`, `{type:'error', error}`). The assistant message is persisted to SQLite only once the stream completes. Preload exposes this as `onStreamChunk(streamId, callback) -> unsubscribe`.

**Groq client note**: `getGroqClient()` in `groqClient.ts` constructs the `OpenAI` client lazily on first call, not at module load. ES module imports are hoisted/evaluated before `index.ts`'s own top-level `loadEnv()` call runs, so an eagerly-constructed client at import time would read `GROQ_API_KEY` before `.env` is loaded — this bit us once already; keep it lazy.

**Voice**: push-to-talk, not wake-word/always-listening (no background audio capture). Renderer records via `getUserMedia` + `MediaRecorder` (`audio/webm;codecs=opus`), sends the raw `ArrayBuffer` over `window.electron.transcribeAudio(audio, mimeType)` → `voice:transcribe` → Groq's hosted `whisper-large-v3-turbo` endpoint (via `openai`'s `toFile()` helper, same `GROQ_API_KEY`). The transcript is then sent through the normal `sendMessage` flow, same as typed input. This is a deliberate trade-off: Groq's free tier (2000 transcriptions/day, no credit card) avoids requiring a local whisper.cpp build + ffmpeg + large model download, at the cost of audio leaving the device — swap out `voice.ts` for a local STT engine later if that trade-off changes. Text-to-speech is fully local/offline: `window.speechSynthesis`/`SpeechSynthesisUtterance` (Web Speech API) in `ChatWindow.tsx`, toggled per-window, uses OS-installed voices, zero new dependencies. Mic access requires `session.defaultSession.setPermissionRequestHandler` in `main/index.ts` (Electron denies `media` permission requests by default).

**Storage**: `better-sqlite3` database at `app.getPath('userData')/sofii.db` (WAL mode), schema created idempotently (`CREATE TABLE IF NOT EXISTS`) on `initDb()` at startup — no migration framework yet, single-user so no `user_id` column.

Config/build wiring: `electron.vite.config.ts` defines the three build targets (main/preload/renderer) and the `@renderer` alias to `src/renderer/src`; `tsconfig.node.json` (main/preload) and `tsconfig.web.json` (renderer) extend `@electron-toolkit/tsconfig` presets and are referenced from the root `tsconfig.json`; `vitest.config.ts` targets `src/main/**/*.test.ts`. `electron-builder.yml` controls packaging (excludes `.env*`, `src/*`, config files from the shipped app; mac entitlements request camera/mic/documents/downloads access even though the app doesn't currently use them — revisit once voice/file features land).

## Environment

Requires a `GROQ_API_KEY` in `.env` (loaded via `dotenv` in `src/main/lib/env.ts`, `override: true`; see `.env.example` for the template). Never commit `.env` (git-ignored) or log its contents beyond the existing presence check.

## Style

Prettier: single quotes, no semicolons, 100 print width, no trailing commas (`.prettierrc.yaml`). ESLint config (`eslint.config.mjs`) is the `@electron-toolkit` TS + React (flat/recommended, jsx-runtime) config with react-hooks (including the stricter React Compiler rules, e.g. `set-state-in-effect` — avoid calling setState synchronously at the top level of a `useEffect` body; prefer inline `.then()`/async callbacks or a `key`-based remount instead) and react-refresh (vite) rules, Prettier conflicts disabled via `eslintConfigPrettier`.
