# Seishin — Project State

## Status
Serverless Expo/RN life-management app; Android-first dev builds, MMKV storage.

## Current Focus
- 2026-11-10: Multimodal on-device agent — `training/seishin_vision_colab.ipynb` (Qwen3-VL-2B → GGUF + mmproj) and app support for a vision projector (Settings) + image parts in local agent turns. Not yet trained/QA'd.
- 2026-11-10: `training/` — Colab notebook fine-tunes a fast on-device tool-calling model (Qwen2.5-0.5B → GGUF) on the app's real tool schemas. Not yet run.
- 2026-10-16: Ported WIP prefs onto main's theme store (12/24h clock, week start, text size, density, start tab), new paged onboarding, TierBadge. Fixed backup restore not re-arming event alarms. Typecheck + 175 tests green; 7 commits unpushed.
- 2026-10-13: Production hardening — CI green again (TS 6 types), NIM key in SecureStore, llama.rn job queue, dead music deps removed, SDK 57 patches aligned (Hermes fix). Needs a new dev build.
- 2026-10-09: Merged feature branch to main. One close-safe `Sheet` for every bottom sheet (fixes floating empty sheets); live sync (60 s open / 15 min closed). Local theme/widgets WIP parked on `wip/local-theme-widgets`.
- 2026-08-24: Agentic OS initialized (kernel + @dev/@designer + /daily-sync).
- 2026-10-09: Smart capture + persistent reminders + connectors (ADR 0002). Needs a new dev build (expo-calendar).
- 2026-10-07: Calendar redesign (timeline/agenda/upcoming, quick add) + runtime theming (ADR 0001).

## Open Threads
- Run the vision notebook; on-device QA: attach poster/bill/schedule photo → correct tool calls; RAM/latency on the Infinix (~1.8 GB loaded); projector load failure falls back to text.
- Factory reset doesn't delete Documents/Models (GGUF/mmproj files) — RULES says it should.
- Run `training/seishin_agent_colab.ipynb` on a Colab T4; QA the GGUF on device (tool calls, latency of ~2.2k-token tool prompt).
- On-device QA after new build: NIM key survives upgrade (migrated to SecureStore); Smart capture while agent chat is generating.
- Remaining `npm audit` items are build-toolchain; runtime `query-string` (expo-router) waits for the next SDK.
- On-device QA: local agent tool calls with the real GGUF (add task/event/note, multi-step), Stop button mid-tool.
- On-device QA: open/close every sheet (calendar +, event form, item detail, note actions, note add/more/YouTube, agent attach, settings model, inbox) — no empty sheet left behind.
- On-device QA: text size / density scaling (calc(var()) in NativeWind), Monday week start in grid + Month widget, onboarding personalise page. `wip/local-theme-widgets` can be deleted once verified.
- On-device QA of dark themes inside native bottom sheets / date pickers.
- On-device QA: calendar sync with a real Google account; reminder actions with app killed.
