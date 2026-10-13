# Seishin — Project State

## Status
Serverless Expo/RN life-management app; Android-first dev builds, MMKV storage.

## Current Focus
- 2026-10-13: Production hardening — CI green again (TS 6 types), NIM key in SecureStore, llama.rn job queue, dead music deps removed, SDK 57 patches aligned (Hermes fix). Needs a new dev build.
- 2026-10-09: Merged feature branch to main. One close-safe `Sheet` for every bottom sheet (fixes floating empty sheets); live sync (60 s open / 15 min closed). Local theme/widgets WIP parked on `wip/local-theme-widgets`.
- 2026-08-24: Agentic OS initialized (kernel + @dev/@designer + /daily-sync).
- 2026-10-09: Smart capture + persistent reminders + connectors (ADR 0002). Needs a new dev build (expo-calendar).
- 2026-10-07: Calendar redesign (timeline/agenda/upcoming, quick add) + runtime theming (ADR 0001).

## Open Threads
- On-device QA after new build: NIM key survives upgrade (migrated to SecureStore); Smart capture while agent chat is generating.
- Remaining `npm audit` items are build-toolchain; runtime `query-string` (expo-router) waits for the next SDK.
- On-device QA: local agent tool calls with the real GGUF (add task/event/note, multi-step), Stop button mid-tool.
- On-device QA: open/close every sheet (calendar +, event form, item detail, note actions, note add/more/YouTube, agent attach, settings model, inbox) — no empty sheet left behind.
- Port widgets/onboarding from `wip/local-theme-widgets` onto the new theme system.
- On-device QA of dark themes inside native bottom sheets / date pickers.
- On-device QA: calendar sync with a real Google account; reminder actions with app killed.
