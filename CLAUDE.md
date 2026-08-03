# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Sofii is a local-first Electron desktop AI assistant (React + TypeScript, built with `electron-vite`), single-user with no accounts/auth/hosted backend. Conversations and messages persist locally in SQLite. The renderer sends chat messages to the main process over IPC; the main process persists them, streams a reply from Groq's OpenAI-compatible chat completions API (`openai/gpt-oss-120b` by default — see Model note below), and pushes tokens back to the renderer as they arrive. The assistant can also call tools mid-conversation (create reminders/memories, list reminders) via Groq tool-calling. Push-to-talk voice input (Groq-hosted Whisper), local text-to-speech (Web Speech Synthesis), a local long-term memory system (keyword-recall, no embeddings), and local reminders/scheduling (native OS notifications) are also implemented — see Architecture below.

This app is being built incrementally against a much larger long-term product vision (broader automation/agents, search, maps, etc. — see prior planning discussions). Later phases are not yet built and should follow the same local-first, free/open-source-first, no-auth approach unless explicitly reconsidered.

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
    db.ts         #   SofiiDb class: better-sqlite3 conversations/messages/memories CRUD + schema init
    db.test.ts    #   Vitest tests for db.ts, using in-memory (:memory:) SQLite
    groqClient.ts #   lazily-constructed Groq/OpenAI SDK client (see note below)
    memoryRanking.ts      # pure keyword-overlap relevance scoring for memory recall (see note below)
    memoryRanking.test.ts #   Vitest tests, no DB/Electron involved
    scheduler.ts          # in-process setTimeout scheduling for reminders (see note below)
    scheduler.test.ts      #   Vitest tests using vi.useFakeTimers(), no Electron involved
    reminderFiring.ts     # fireReminder(): Notification + status update + broadcast (shared by ipc/reminders.ts and tools.ts — see Reminders note)
    tools.ts              # tool-calling: TOOL_DEFINITIONS (JSON schemas) + executeToolCall() async dispatcher (see Tool-calling note below)
    tools.test.ts          #   Vitest tests using vi.useFakeTimers(), no Electron involved; mocks global.fetch for the get_weather case
    weather.ts             # get_weather's implementation: free, no-API-key Open-Meteo geocoding + forecast (see Tool-calling note below)
    weather.test.ts        #   Vitest tests with global.fetch mocked — no real network calls in the test suite
  ipc/            # ipcMain handlers only — translate IPC <-> services, no business logic
    chat.ts       #   chat:* channels: conversation CRUD + streaming send-message (also recalls memories, runs tool-calling)
    voice.ts      #   voice:transcribe channel: Groq-hosted Whisper transcription
    memory.ts     #   memory:* channels: memory CRUD
    reminders.ts  #   reminder:* channels: reminder CRUD + wires scheduler to reminderFiring.fireReminder
src/preload/
  index.ts        # contextBridge surface, thin — implements SofiiElectronAPI
  index.d.ts      # declares global window.electron: SofiiElectronAPI
  api.ts          # SofiiElectronAPI interface + shared types (Conversation, ChatMessage, StreamEvent, ...) — single source of truth for the renderer-visible API surface
src/renderer/src/
  App.tsx                      # shell: selected conversation state, chat/memories view switch + layout
  components/ConversationList.tsx  # sidebar: list/select/create/delete conversations + view toggle
  components/ChatWindow.tsx        # message list + composer for the selected conversation
  components/MemoryPanel.tsx       # list/add/delete long-term memories
  components/ReminderPanel.tsx     # list/add/cancel/delete reminders
```

Convention when adding new main-process subsystems (voice, memory, etc. in later phases): follow this same `lib/` (helpers) / `services/` (logic, unit-testable, no Electron-specific imports beyond `app.getPath`) / `ipc/` (thin handler registration) split rather than growing `index.ts` or inlining logic into IPC handlers.

**IPC contract** (`chat:*`, registered by `registerChatIpc()` in `src/main/ipc/chat.ts`):

- `chat:create-conversation`, `chat:list-conversations`, `chat:get-conversation`, `chat:rename-conversation`, `chat:delete-conversation` — plain invoke/return. Renaming can happen manually (double-click a title in `ConversationList.tsx`) or automatically: after a conversation's first exchange, if its title is still the default (`DEFAULT_CONVERSATION_TITLE` in `db.ts`), `chat.ts` fires one extra non-streaming Groq completion to generate a short title before emitting `done` — a manual rename always takes precedence since the auto-title check only fires while the title is still the default.
- `chat:send-message(conversationId, content)` — persists the user message immediately and returns `{ messageId, streamId }` right away; the assistant's reply streams separately over a dynamic per-turn channel `chat:stream:${streamId}` (events: `{type:'chunk', delta}`, `{type:'done', fullContent}`, `{type:'error', error}`). The assistant message is persisted to SQLite only once the stream completes. Preload exposes this as `onStreamChunk(streamId, callback) -> unsubscribe`.

**Groq client note**: `getGroqClient()` in `groqClient.ts` constructs the `OpenAI` client lazily on first call, not at module load. ES module imports are hoisted/evaluated before `index.ts`'s own top-level `loadEnv()` call runs, so an eagerly-constructed client at import time would read `GROQ_API_KEY` before `.env` is loaded — this bit us once already; keep it lazy.

**Model note (read this before changing the model)**: the original model, `llama-3.3-70b-versatile`, is deprecated on Groq's free/developer tier — shutdown 2026-08-16 — so the default is now `openai/gpt-oss-120b` (Groq's recommended replacement, itself designed for tool-calling). `getGroqModel()` reads `GROQ_MODEL` from the env first so a future deprecation is a config change, not a code change — check `console.groq.com/docs/deprecations` if chat suddenly starts failing. gpt-oss-120b is a **reasoning model**: verified against the live API that it streams hidden chain-of-thought as a separate `delta.reasoning` field (with `channel: "analysis"`) _in addition to_ the real answer in `delta.content`, and — critically — those reasoning tokens are generated and counted against `max_tokens` **even when suppressed from the response** (confirmed: a `max_tokens: 20` call returned empty content with `finish_reason: "length"` because 18 of the 20 tokens went to invisible reasoning). `SUPPRESS_REASONING` (`groqClient.ts`: `{ reasoning_effort: 'low', include_reasoning: false }`, Groq-specific fields not in the `openai` SDK's types, hence the `as ChatCompletionCreateParams... & GroqReasoningParams` casts at each call site) hides the reasoning text from responses, but every `max_tokens` budget in this codebase still needs headroom above the visible output length to absorb it — this is why `autoTitleConversation`'s budget is 150, not ~20, despite titles being a few words.

**Tool-calling**: `chat.ts`'s `streamAssistantReply` passes `TOOL_DEFINITIONS` (from `services/tools.ts`) with `tool_choice: 'auto'` on the first streamed completion call. `streamCompletion()` (shared helper, used for both rounds) forwards `delta.content` to the renderer as before and separately accumulates `delta.tool_calls` by index (Groq was observed sending a whole tool call's id/name/arguments in a single chunk in practice, but this accumulates defensively in case a future response fragments it like some other providers do). If any tool calls come back, `executeToolCall()` (async — `create_reminder`/`create_memory`/`list_reminders` are sync-under-the-hood but `get_weather` needs a network round-trip, so the whole dispatcher returns a `Promise<string>` uniformly) runs each one against the real DB, and results are awaited concurrently via `Promise.all` in `chat.ts` since independent tool calls shouldn't block each other. For `create_reminder`, execution also calls `scheduleReminder` + shares `reminderFiring.fireReminder` with the Reminders UI, so a reminder created mid-chat actually fires later, not just gets persisted inert. A **second, bounded** completion call (no `tools` option, so the model has nothing left to call) then produces the final natural-language reply, which continues streaming to the same channel. The tool-call/tool-result exchange is never persisted to SQLite — only the final visible text becomes the `assistant` message — so the `messages` table schema and `MessageRole` type didn't need to change. The system prompt includes the current date/time so relative expressions ("in 10 minutes", "tomorrow at 5pm") resolve to an absolute ISO timestamp; the reminder-creation and weather flows were each verified end-to-end against the live Groq + (for weather) live Open-Meteo APIs before being wired in — correct tool-call args, a coherent final reply grounded in the real tool result, and zero further tool calls in round 2.

**get_weather / `weather.ts`**: current conditions + 3-day forecast via Open-Meteo's geocoding (`geocoding-api.open-meteo.com`) and forecast (`api.open-meteo.com`) APIs — genuinely free, no API key or signup at all, unlike a general web-search tool would need (that's why weather was picked over search as the next tool). WMO weather codes are mapped to readable descriptions via `describeWeatherCode()`. `getWeather()` itself returns an `Error: could not find a location...` string (not a throw) when geocoding finds nothing, but throws on network/HTTP failure; `tools.ts`'s `get_weather` case catches that and converts it to an `Error fetching weather: ...` string, consistent with `executeToolCall`'s "never throws" contract.

**Voice**: push-to-talk, not wake-word/always-listening (no background audio capture). Renderer records via `getUserMedia` + `MediaRecorder` (`audio/webm;codecs=opus`), sends the raw `ArrayBuffer` over `window.electron.transcribeAudio(audio, mimeType)` → `voice:transcribe` → Groq's hosted `whisper-large-v3-turbo` endpoint (via `openai`'s `toFile()` helper, same `GROQ_API_KEY`). The transcript is then sent through the normal `sendMessage` flow, same as typed input. This is a deliberate trade-off: Groq's free tier (2000 transcriptions/day, no credit card) avoids requiring a local whisper.cpp build + ffmpeg + large model download, at the cost of audio leaving the device — swap out `voice.ts` for a local STT engine later if that trade-off changes. Text-to-speech is fully local/offline: `window.speechSynthesis`/`SpeechSynthesisUtterance` (Web Speech API) in `ChatWindow.tsx`, toggled per-window, uses OS-installed voices, zero new dependencies. Mic access requires `session.defaultSession.setPermissionRequestHandler` in `main/index.ts` (Electron denies `media` permission requests by default).

**Reminders**: fully local, zero new dependencies or credentials — `scheduler.ts` keeps an in-process `Map<reminderId, Timeout>` and schedules one `setTimeout` per pending reminder (clamped to `setTimeout`'s ~24.8-day max delay). `registerReminderIpc()` calls `initScheduler()` once at startup: any pending reminder whose time already passed while the app was closed fires immediately (verified end-to-end against the real DB, not just fake-timer unit tests — see `scheduler.test.ts` for the logic, but the missed/future firing paths were also manually confirmed by inserting rows directly and rebooting); everything else gets scheduled normally. Firing (`services/reminderFiring.ts`'s `fireReminder()`, shared by both `ipc/reminders.ts` and `services/tools.ts` since a reminder created via a chat tool call needs the exact same side effects as one created through the UI) shows a native `Notification` (`Notification.isSupported()` guard), flips the reminder to `status: 'fired'` in SQLite, and broadcasts a `reminder:fired` event to every open window so `ReminderPanel.tsx` can live-refresh. The UI still uses a plain `datetime-local` input (no natural-language parsing there), but chat-integrated reminder creation now works via tool-calling — see the Tool-calling note below.

**Memory**: explicit only — the user adds/edits/deletes memories themselves (double-click a memory to edit it) via the "🧠 Memories" view (`MemoryPanel.tsx`, toggled in `App.tsx`/`ConversationList.tsx`); there's no automatic inference/extraction of memories from conversation content (that's a fuzzier, LLM-classification-driven feature, deferred). Retrieval is **keyword-overlap scoring in plain JS** (`memoryRanking.ts`'s `rankMemoriesByRelevance`), not semantic/vector search — a deliberate trade-off to avoid a ~200MB local embedding runtime (`@huggingface/transformers`/onnxruntime-node) with real Electron native-module-rebuild risk and a first-run model download, similar reasoning to the voice STT trade-off above. Fine at single-user local scale (dozens–hundreds of memories); swap in embeddings behind the same `rankMemoriesByRelevance(memories, query, limit)` signature later if needed. `chat.ts`'s `streamAssistantReply` calls this with the latest user message as the query and injects any matches (score > 0 only) into the system prompt before calling Groq — silently a no-op when no memories match or none exist yet.

**Storage**: `better-sqlite3` database at `app.getPath('userData')/sofii.db` (WAL mode), schema created idempotently (`CREATE TABLE IF NOT EXISTS`) on `initDb()` at startup — no migration framework yet, single-user so no `user_id` column.

Config/build wiring: `electron.vite.config.ts` defines the three build targets (main/preload/renderer) and the `@renderer` alias to `src/renderer/src`; `tsconfig.node.json` (main/preload) and `tsconfig.web.json` (renderer) extend `@electron-toolkit/tsconfig` presets and are referenced from the root `tsconfig.json`; `vitest.config.ts` targets `src/main/**/*.test.ts`. `electron-builder.yml` controls packaging (excludes `.env*`, `src/*`, config files from the shipped app; mac entitlements request camera/mic/documents/downloads access even though the app doesn't currently use them — revisit once voice/file features land).

## Environment

Requires a `GROQ_API_KEY` in `.env` (loaded via `dotenv` in `src/main/lib/env.ts`, `override: true`; see `.env.example` for the template). Never commit `.env` (git-ignored) or log its contents beyond the existing presence check.

## Style

Prettier: single quotes, no semicolons, 100 print width, no trailing commas (`.prettierrc.yaml`). ESLint config (`eslint.config.mjs`) is the `@electron-toolkit` TS + React (flat/recommended, jsx-runtime) config with react-hooks (including the stricter React Compiler rules, e.g. `set-state-in-effect` — avoid calling setState synchronously at the top level of a `useEffect` body; prefer inline `.then()`/async callbacks or a `key`-based remount instead) and react-refresh (vite) rules, Prettier conflicts disabled via `eslintConfigPrettier`.
