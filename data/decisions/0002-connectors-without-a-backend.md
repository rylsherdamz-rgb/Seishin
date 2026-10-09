# ADR 0002 — Connectors without a backend

**Date:** 2026-10-09 · **Status:** Accepted

## Context
Users want Seishin to sync with Google Calendar and pull files from Google
Drive. RULES.md forbids backend servers; Google's REST APIs need OAuth client
credentials, token storage/refresh, and (for Drive) app verification.

## Decision
Connect through what the phone already syncs, not through Google's APIs:
- **Calendars** — `expo-calendar` (device calendar provider). Any account on
  the phone (Google, Outlook, Samsung) syncs both ways with no sign-in in
  Seishin. Imported events are read-only in Seishin (`source: "calendar"`);
  Seishin events and task deadlines are written to one chosen calendar.
  Planning is pure (`calendar-sync-plan.ts`, tested); imported events are never
  re-exported, and stores are reloaded from storage before each sync so an
  unloaded store can never be mistaken for "everything deleted".
- **Drive / OneDrive / Dropbox** — the system document picker, which lists
  every installed storage provider. Read-only, per pick.
- **Notifications** — existing notification listener.

## Consequences
- `expo-calendar` is a native module: a new dev build is required.
- No background Drive folder watching; true Drive API sync would need OAuth
  and is out of scope until a sign-in story exists.
- Calendar sync runs on launch, on foreground (10 min gap) and 8 s after
  edits — not while the app is closed.

## Addendum — productivity connectors & background sync (2026-10-09)
- **Token connectors (direct device → service, no relay):** Todoist (personal API
  token, unified API v1) and Notion (internal integration secret, API version
  2025-09-03 data sources). Tokens live in `expo-secure-store` (Keystore/Keychain).
- **Calendar feeds (.ics):** Canvas, Google Classroom, Moodle, Outlook, any
  subscription link. Deadline-looking entries become tasks with reminders.
- **Reconciliation rules** (`task-sync-plan.ts`): completion syncs both ways;
  vanished upstream ⇒ completed locally, never deleted. Imported calendar/feed
  events are read-only and never exported back.
- **Background:** `expo-background-task` (WorkManager / BGTask) ~every 30 min,
  plus launch, foreground and post-edit syncs, through one `syncEverything`.
- **Not done:** Google Tasks, Microsoft To Do, Slack, Gmail — they require OAuth
  app registration; revisit if a sign-in story is added.
