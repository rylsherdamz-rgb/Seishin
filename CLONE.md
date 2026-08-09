# Seishin — Full App Blueprint (RN → Kotlin Port Reference)

> Purpose: complete documentation of the existing React Native (Expo) app so it can be re-implemented natively in Kotlin.
> Stack being replaced: React Native 0.86 + Expo SDK 57 + expo-router + NativeWind (Tailwind) + Zustand + MMKV + react-native-calendars.

---

## 1. App Overview

**Seishin** — "serverless life manager". Single-device, no backend. Combines:

- **Calendar** with recurring events + reminders (system notifications)
- **Todo list** (dates, priorities, overdue tracking)
- **Notes** (rich text-free editor, photo/file attachments, OCR text extraction, YouTube transcript summaries, tags, pinning)
- **Inbox** (captured phone notifications/emails/chats with "Send to AI" + "Add to Calendar")
- **AI Agent** (chat with tool-calling; two providers: NVIDIA NIM cloud API or on-device GGUF via llama.rn; persistent knowledge-graph memory)
- **Invites** (invite cards, P2P codes, shared todo codes — currently local-only stubs)
- **Settings** (AI config, notification listener service, per-category storage clearing, auto-cleanup policies, factory reset)

All data lives in 10 MMKV stores (key-value, JSON strings). No network sync.

**Design language:** strict monochrome (black/white/gray). Single accent color = red (`danger`, destructive only). Green (`success`) for status states. Soft shadows, rounded cards (12px), rounded sheets (20px), pills/chips, feather icons. English UI.

---

## 2. App Entry & Flow (`app/_layout.tsx`)

| Phase | Behavior |
|---|---|
| `splash` | Animated logo (scale 0.3→1 + fade, Reanimated). `ExpoSplashScreen.hideAsync()` on mount. 600ms then `setPhase(...)` |
| `onboarding` | Full-screen onboarding (dark status bar) with a complete button → sets `settingsStorage["hasSeenOnboarding"]=true` |
| `app` | `ErrorBoundary` > GestureHandlerRootView > BottomSheet Host > SafeAreaProvider > Stack (no headers). Routes: `(tabs)`, `todo`, `invites`, `note` |

- Root calls `useNotifications()` (registers listeners + permission request + `scheduleTodayReminders()`).
- Stack screens `todo`, `invites`, `note` animate `slide_from_right`.
- Status bar: dark background `#1a1a1a`, light content.

---

## 3. Bottom Navigation — 4 Tabs (`app/(tabs)/_layout.tsx`)

| Tab | Route | Icon (active/inactive) |
|---|---|---|
| Calendar | `index` | calendar / calendar-outline |
| Notes | `notes` | document-text / document-text-outline |
| Agent | `agent` | flash / flash-outline |
| Settings | `settings` | settings / settings-outline |

Tab bar: white bg, top hairline `#eeeeee`, height 70 + bottom inset, active tint black `#000`, inactive `#999`, font-size 11 semibold, letter-spacing -0.1.

---

## 4. Screen 1 — Calendar (`app/(tabs)/index.tsx`)

### Layout (top → bottom)
1. **Header**: "Calendar" (24px semibold, tracking -0.02em) + subtitle `{n} events · {m} todo dates`. FAB right: 44px black circle, white plus icon.
2. **Month bar**: tap month label toggles calendar expand/collapse (chevron-up/down). Right: "Today" pill (only when month ≠ current), chevron-left/right month navigation.
3. **Calendar widget** (react-native-calendars, `Calendar`, multi-dot marking) — capped at **25% of window height** (min 168px), hidden when collapsed. Theme: black selected day (circle 22px), gray today bg, black arrows, font 12/11. Dots: black dot = has event(s), gray dot = has todo(s). Tap day = select; **long-press day = open event form directly for that date**.
4. **List header row**: section title ("All items" or selected date long-form) + TODAY/PAST pill + "Show all / Show day" toggle + legend (black dot = Events, gray dot = Todos).
5. **Item list** (FlatList): either *day view* (selected date) or *all view* (sorted by date then time). Grouped with date headers: black vertical bar + weekday label + TODAY/PAST pill + "Show day" link. Date sections ordered past→future; past items at 55% opacity.

### Item cards
- **Event card**: 40px black circle icon (per source: manual=edit-2, ocr=camera, email=mail, notification=bell, chat=message-circle, ai=cpu) + "EVENT" eyebrow + title + description (1 line) + row: clock icon, `time` (start time, hh:mm), `·`, source (capitalized), `·` repeat icon if recurring, `·` bell + `{n}min` if reminder set. Chevron-up on right. Tap → detail sheet.
- **Todo card**: checkbox (20px rounded-md border-2; filled black with white check when done) + "TODO" eyebrow + title (strikethrough + gray when done) + date + `· priority`. Tap checkbox toggles completion (sheet stays open via `onTodoToggle`), tap card opens detail sheet.

### Add flow (+ FAB or long-press)
Bottom sheet (auto-sizing, pan-down-to-close) with two modes:
- **Menu mode**: "Add to Calendar" title; rows → **Add Event**, **Add Todo** (→ `/todo` screen), **New Note** (→ `/note` screen).
- **Form mode** (Add Event) — fields in order:
  1. Title (TextInput, required — AlertDialog "Missing title" if empty)
  2. Date (tap → picker; iOS: `PickerModal` inline date; Android: native `DateTimePicker` dialog)
  3. Time (start; same picker pattern)
  4. End time (stop-circle icon; default start + 1h; clamped to start+1h if ≤ start)
  5. Repeat chips: None / Daily / Mon–Fri / Mon–Sun / Weekly / Monthly / Custom
     - Custom → weekday circle row S M T W T F S (black filled = selected)
  6. Reminder chips: None / 15 min before / 30 min before / 1 hr before
  7. Notes (multiline)
  8. Save Event (black full-width 48px button)
- Form wrapped in ScrollView (sheet auto-fits content). **Draft autosave**: every field change writes `eventDraft` (title, notes, startDate, endDate, repeatMode, customWeekdays, reminderMinutes) to settingsStorage; restored on next open; cleared on save.
- `saveEvent` builds `startDate` from date+time, `endDate` from date+end time, recurrence from mode, `reminder` minutes; calls store `addEvent` (which schedules the system notification alarm via `scheduleEventReminder`).

### Event detail sheet — `ItemSheet` (see §11)

### Range
Events rendered within visible range: **-90 days to +366 days** from today. `expandOccurrences` materializes recurring events across range.

---

## 5. Screen 2 — Notes & Inbox (`app/(tabs)/notes.tsx`)

Tab control (SegmentedControl): **Notes | Inbox**.

### Notes tab
1. Header "Notes" + `{n} notes` count; black FAB (+) → new-note sheet (Blank Note / Take Photo / Choose Photo / Upload File / YouTube Summary → opens `/note?action=...`).
2. Search bar (ink-50 rounded-xl, search icon, clear X).
3. Tag filter row (horizontal chips: All + each tag, black pill when active).
4. **2-column masonry-style grid** (rows of 2): sections "PINNED" and "OTHERS" headers (uppercase tracking-widest). Card: optional image header (h-24 cover), title (2 lines) or "Untitled", body preview (4 lines w/ image, 8 w/o), meta row: black "event" pill if linked to event, paperclip + count chip if files, `#tag` chips, date (MMM d).
5. Empty state: "No notes yet" / "No matching notes".

### Inbox tab
1. Filter chips: All / Notification / Email / Chat.
2. Selection mode (check-square icon): select-all / mark-read / delete / **Send to AI** (builds message `From my inbox:\n<content>\n\nAdd these to my schedule where appropriate.`, pushes to `/agent`).
3. Item list: icon bubble (black when unread, gray when read; bell/mail/message-circle by type), unread = black left border (3px), title, body (2 lines), source with @ icon. Tap = mark read; long-press = action sheet (Add to Calendar if `pendingEvent` parsed, Send to AI, Mark Read, Delete).
4. Header shows `{unread} unread · {total} total`.

### ItemSheet actions for inbox items
- **Add to Calendar**: creates event from `pendingEvent` (`source: "notification"`), marks read, closes.
- **Send to AI**: adds user message to agent store, navigates to Agent tab.
- **Mark Read / Delete**.

---

## 6. Screen 3 — AI Agent (`app/(tabs)/agent.tsx`)

### Header
- "AI Agent" title + status subtitle:
  - NIM mode: `NVIDIA NIM` + ` · auto-routes {fast}→{smart}` when large model set (model-tier auto-routing)
  - Local mode: "Loading model…" / "Local (offline) · Ready" / "Local · Error" / "Local (offline)" + " · Thinking…" when processing
- Right: settings circle button (→ `/settings`), trash circle button (clear conversation confirm dialog).

### Provider pills
- **Local GGUF** and **NVIDIA NIM** segmented pills (black = active). NIM disabled + dimmed without API key.
- NIM pill shows current model short-name + tier badge (fast=green, balanced=yellow, smart=red).
- Auto-behavior: if a NIM key exists and provider is local → auto-switch to NIM. If provider is local and model path set → auto-load GGUF model (progress %). If NIM + model loaded → unload.

### Status banners (below header)
- NIM without key → red soft banner "No NIM API key set…"
- Local loading → progress bar (black fill) + `{modelProgress}%`
- Local ready → green banner
- Local error → red banner + Retry button + error text
- Local unloaded, no path → gray banner "No GGUF model selected…"

### Chat list
- Messages: user = black bubble right-aligned (white text, rounded-2xl, bottom-right radius 6), assistant = white bubble border ink-100 left (bottom-left radius 6), tool = gray ink-25 bubble with terminal icon header + tool name (mono) + green check.
- Avatar: assistant = gray circle cpu icon; user = black circle user icon.
- Assistant content rendered as **Markdown** (custom renderer — headings, bold, lists, code).
- Footer per message: time + Copy/Copied button (clipboard, 1.5s state).
- Attachments inline: image thumbnails (80px), file chips.
- Processing: `ThinkingIndicator` — 3 animated dots (Reanimated opacity pulse, 400ms stagger). Auto-scroll to end on new messages.
- Empty state: cpu medallion, "Ask me anything" + context line; **suggestion chips** (Todo / Event / Note / Today) that prefill the input with sample prompts (only when idle + no messages).

### Input bar
- Paperclip button (opens bottom sheet: Take Photo / Choose from Library / Pick File).
- Text input (ink-50 rounded-xl). While processing: input disabled, send button → red **stop** square (calls `stopAgentLoop`).
- Send: black circle arrow-up (disabled/dimmed when empty).
- Pending attachments strip above input: thumbnails with red X remove badges.
- iOS-only keyboard padding (`Platform.OS === "ios" ? keyboardHeight : 0`; Android resizes itself).

### Attachment → context pipeline
On send with attachments: images run through OCR (`recognizeText`); result becomes `[Image: name]\n<text>` context; files become `[File attached: name]`. Fed into agent as extracted context.

---

## 7. Screen 4 — Settings (`app/(tabs)/settings.tsx`)

ScrollView with sections (SectionHeader = uppercase 11px tracking-widest gray):

### Quick Access
- **Todo List** → `/todo`, **Invites** → `/invites` (MenuRow list).

### AI Configuration (collapsible card)
- **NVIDIA NIM API Key** (secure TextInput), **NIM Endpoint** (default `https://integrate.api.nvidia.com/v1`), **Model** (opens model picker bottom sheet: search field + FlatList of all models from `fetchAllNimModels`, each row with tier badge + check; "Loading models…" spinner; quick chips: Llama 1B / 3B, Mistral 7B, Nemotron 70B). Save button → validates + caches models (`cacheNimModels`), shows "Saved" dialog.
- **Local GGUF Model**: file picker row (folder icon, "Tap to select a .gguf file"), shows filename + size + X to clear; Save copies the file into `Documents/Models/` (progress UI, non-blocking), stores the new path. Shows "Model copied and ready" or error dialog.

### Notifications
- **Notification Listener** row (bell): status dot green "Service active" / gray "Tap to enable"; opens Android notification-access settings. Reflects `expo-android-notification-listener-service` permission.
- **Foreground Service** row (volume-2, static).

### Storage (collapsible)
- Rows per storage with item counts + **Clear** buttons (confirm dialog): Calendar Events, Messages, Email Cache, Notifications, Agent Memory, OCR History, Todo Lists, Invites.
- **Factory Reset — Delete All** (destructive Button): confirm → `clearAllStorage()` + `clearOcrHistory()`.

### Auto-Cleanup
- Steppers (min 1, max 365 days): Notifications (14), Email Cache (30), Chat Messages (90), OCR Images (7).

### About
- Logo + "Seishin" + v1.0.0 + "Serverless life manager".

---

## 8. Screen 5 — Todo List (`app/todo.tsx`, pushed route)

1. Header: back arrow, logo, "Todo List", `{active} pending · {done} done`; check-circle button (clears completed, confirm dialog).
2. Filter chips: All / Active / Completed.
3. **Add Todo** dashed button toggles an inline form card: title input (autofocus) + due-date row (calendar icon, native `DateTimePicker` on both platforms, X to clear) + Cancel / Add buttons.
4. List: card rows with checkbox (toggle), title (strikethrough when done), due row (clock, date; **OVERDUE** black pill + bold black text when past due & incomplete; **TODAY** gray pill), priority label colored (low=ink-300, medium=black, high=red `#ff3b30`), chevron.
5. Tap row → ItemSheet (todo mode): toggle, delete, close.
6. Supports `?eventId=` param (linking todo to event).
7. Draft autosave (`todoDraft`: title, dueDate) restored on next visit, cleared on add.
8. Filters persist in store (`filter`).

---

## 9. Screen 6 — Note Editor (`app/note.tsx`, pushed route)

1. Header: back (persists on exit), **"Saved" chip** (green check, appears 2s after each autosave), pin bookmark button (black when pinned), trash (red, confirm dialog).
2. Body ScrollView:
   - "Linked to event" black pill when `eventId` param present.
   - Title (multiline 24px semibold), body (16px ink-800, min-height 160px).
   - "Reading text from image…" spinner row while OCR runs.
   - Image attachments: 96px thumbs with black X badge (remove).
   - File attachments: card rows (file-text icon, name, `mime · size`), X remove.
   - Toolbar (4 equal buttons): **Camera / Photo / File / YouTube**.
   - Tags: `#tag` pills with X; tag input row (tag icon, `#` strip, plus button).
3. **Autosave**: every keystroke persists (skips initial mount for existing notes so `updatedAt` isn't bumped). Flush on unmount (covers gesture-back). Empty notes (no title/body/tags/attachments) are not created.
4. **YouTube Summary** bottom sheet (40%): URL input → fetches transcript (youtubei.js), summarizes via NIM, sets title to video title, appends summary to body, downloads thumbnail as image attachment. Errors → native alert.
5. **Photos** are OCR'd into the body under `\n\n— Scanned text —\n<text>`.
6. Deep-link actions via `?action=camera|photo|file|youtube` auto-trigger the picker once on fresh notes.

---

## 10. Screen 7 — Invites (`app/invites.tsx`, pushed route)

1. Header: back, "Invites", `{n} total`.
2. Tab chips: **Cards / P2P Codes / Shared** (with icons).
3. Per-tab create controls:
   - Cards: title + description inputs → "Create Invitation Card" (status `draft`).
   - P2P: "Generate P2P Code" → 6-char code (A-Z minus I/O, 2-9) → dialog.
   - Shared: "Share Todo List" → stub code dialog.
4. List cards: type icon, title, description, mono code box (if any), created date + status; share (system share sheet: `Seishin Invite: … Code: …`) and trash (confirm) actions.
5. Empty state: "No invites yet".

---

## 11. Shared Component — ItemSheet (`src/components/ItemSheet.tsx`)

Bottom sheet (snap points 35%/50%, pan-down-close) showing either an **event** or a **todo**:

### Event mode
- Header: source icon (colored circle per source), title, meta row (date, time, source; "Reminder · N min before" when set; repeat label when recurring).
- **Linked notes** section (subscription to notes store, `eventId` match) — each row tap → `/note?id=…`; **Add Note** button → `/note?eventId=…`.
- **Linked todos** section (`eventId` match, subscription to todo store) — checkbox rows; tapping toggles **in-sheet without closing** (reactive).
- **Add Todo** button → `/todo?eventId=…`.
- **Delete Event** (red outline button) → confirm dialog → `onEventDelete` + `cancelEventReminder(id)`.

### Todo mode
- Title, meta (date, priority), body if present.
- Checkbox "Mark as Done / Reopen" (toggles then closes), Delete (confirm).

---

## 12. Shared UI Components (`src/components/ui/`)

| Component | Behavior / Variants |
|---|---|
| `AlertDialog` | **Centered RN Modal** (fade). Black title, gray message, optional confirm button (destructive red variant). Used for all confirms + info dialogs. |
| `SheetModal` | Bottom sheet (modal) with title, message, and option rows (icon + label, optional destructive). Action-menu pattern. |
| `PickerModal` | Centered fade modal with inline `DateTimePicker` (`display="inline"`), Cancel/Done. iOS date/time picking. |
| `Card` | `variant`: filled (gray bg), elevated (white + border + shadow), outlined (hairline). Padded 16. Optional title/description/caption. Touchable when `onPress`. |
| `Chip` | Pill: active = black filled white text; inactive = white + ink-200 border. Optional icon. |
| `Button` | Solid black primary / destructive red (`#ff3b30`) variants, icon support. |
| `IconButton` | Circular: solid (black) / surface (gray) / plain. sm 36px, md 44px. |
| `Input` | Styled TextInput wrapper (ink-50 rounded-xl). |
| `Toggle` | Switch-style toggle. |
| `SegmentedControl` | Ink-50 track with white sliding pill; options `{label, value}`. |
| `EmptyState` | Centered medallion (gray ring + icon) + title + subtitle. |
| `ScreenHeader` | Standard screen header block. |
| `Markdown` (`src/components/Markdown.tsx`) | Minimal markdown renderer for agent replies (headings, bold, lists, code). |
| `Logo` (`src/components/Logo.tsx`) | Brand mark (white box on black circle style). |
| `ItemSheet` | See §11. |

**Bottom sheet pattern (all screens):** `@expo/ui/community/bottom-sheet` — white bg, `enablePanDownToClose`, `index={visible ? 0 : -1}`, `onChange(index === -1 → hide)`. Sizing: fixed `snapPoints` (e.g. `["35%"]`, `["40%","50%"]`) OR **omit snapPoints entirely to auto-fit content** (event form). Detents area shows drag handle + scrollable content.

---

## 13. Design System (NativeWind theme — `tailwind.config.js`)

### Colors (`ink` ramp — grayscale only)
| Token | Hex |
|---|---|
| ink-black / ink-900 | `#000000` / `#1a1a1a` |
| ink-800 / ink-700 / ink-600 | `#262626` / `#333333` / `#4d4d4d` |
| ink-500 / ink-400 / ink-300 | `#666666` / `#808080` / `#999999` |
| ink-200 / ink-150 / ink-100 | `#cccccc` / `#dcdcdc` / `#e5e5e5` |
| ink-75 / ink-50 / ink-25 | `#eeeeee` / `#f2f2f2` / `#f8f8f8` |
| ink-white | `#ffffff` |
| danger | `#ff3b30` (soft `#ffeceb`) — sole accent |
| success | `#2fbf71` |

### Shadows (black-tinted)
| Token | Value |
|---|---|
| subtle | `0 1px 2px rgba(0,0,0,.06)` |
| card | `0 2px 8px rgba(0,0,0,.06)` |
| raised | `0 4px 12px rgba(0,0,0,.10)` |
| float | `0 8px 24px rgba(0,0,0,.14)` |

### Radii
- card `12px`, sheet `20px`, pills `rounded-full`, inputs `12px` (rounded-xl).

### Type
- Screen titles: 24px semibold, tracking `-0.02em`.
- Eyebrows/section headers: 10–11px bold uppercase, tracking-widest, ink-400.
- Body: 14px; captions: 12px ink-400/300; micro labels 10–11px.
- Mono (`font-mono`) for codes, model names, tool names.

---

## 14. Data Layer — Stores (Zustand + MMKV)

All persistence = MMKV instance per domain, values are JSON strings. Keys below.

### calendar-store (`eventsStorage`, key `"events"`)
```ts
Recurrence { frequency: "daily"|"weekly"|"monthly", interval?: number, weekdays?: number[] (0=Sun), until?: "YYYY-MM-DD" }
CalendarEvent { id, title, description?, notes?, startDate, endDate, allDay?, source: "manual"|"ocr"|"email"|"notification"|"chat"|"ai", reminder?: number (minutes), recurrence? }
```
Actions: `loadEvents`, `addEvent` (→ schedules reminder alarm), `updateEvent` (→ reschedules/cancels reminder), `deleteEvent` (→ cancels reminder), `setSelectedDate`.

### todo-store (`todosStorage`, key `"todos"`)
```ts
Todo { id, title, description?, completed, dueDate?, priority: "low"|"medium"|"high", category, tags: string[], createdAt, completedAt?, inviteId?, eventId? }
```
Actions: load/add/toggle/delete/clearCompleted/setFilter. Filter: all|active|completed.

### notes-store (`notesStorage`, key `"notes"`)
```ts
NoteAttachment { id, type: "image"|"file", uri, name?, mimeType?, size? }
Note { id, title, body, tags: string[], pinned, attachments: NoteAttachment[], eventId?, color?, createdAt, updatedAt }
```
Sorted pinned-first then by updatedAt desc. Actions: load/add/update/delete/togglePin/setQuery/getFilteredNotes (title/body/tags search)/getNotesForEvent.

### inbox-store (`notificationsStorage`, key `"inbox_items"`)
```ts
InboxItem { id, type: "notification"|"email"|"chat", title, body, timestamp (ISO), source, read, deleted?, eventId?, pendingEvent?: { title, startDate, endDate, description? } }
```
Cap 500 items, newest first. Actions: load (sanitizes shape)/addItem/markRead/deleteItem/clearAll/setFilter/getUnreadCount/selection (selectAll, deleteSelected, markSelectedRead, setSelecting). Selected ids stored as `Set`.

### agent-store (`agentStorage`, key `"conversation"`, max 100 msgs)
```ts
AgentMessage { id, role: "user"|"assistant"|"tool", content, timestamp, toolName?, toolResult?, toolCallId?, toolCalls?: [{id,name,arguments}], attachments?: [{type,uri,name?,mimeType?}] }
```
State: currentProvider (`"nim"|"local"`), isProcessing, streamTick (forces re-render of streaming text), modelState (`unloaded|loading|ready|error`), modelProgress, modelError.

### settings-store (`settingsStorage`)
Keys: `emailConfig`, `apiKeys` `{nim}`, `nimEndpoint`, `nimModel`, `nimLargeModel`, `nimCachedModels`, `modelPath`, `cleanupPolicies` `{notificationsDays:14, emailsDays:30, chatDays:90, ocrDays:7}`, `notificationFilter` (package names).
Defaults: endpoint `https://integrate.api.nvidia.com/v1`, model `meta/llama-3.2-1b-instruct`.

### invites-store (`invitesStorage`, key `"invites"`)
```ts
InviteCard { id, type: "invite-card"|"p2p-code"|"shared-todo", title, description?, eventId?, todoId?, code?, peerId?, status: "draft"|"sent"|"received"|"accepted"|"declined"|"active", createdAt, expiresAt?, data: {} }
```
P2P code: 6 chars from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`.

### mmkv instances
`events, messages, emails, notifications, agent, settings, ocr, todos, invites, notes` — each own instance; `clearAllStorage()` wipes all; `getStorageSizes()` = key counts.

### Drafts (`src/utils/drafts.ts` — settingsStorage)
- `todoDraft` `{title?, dueDate?}`, `eventDraft` `{title?, notes?, startDate?, endDate?, repeatMode?, customWeekdays?, reminderMinutes?}`; save/load/clear each.
- Reminder map key (settingsStorage): `"eventReminderNotifs"` → `{ [eventId]: notificationId }` for dedupe.

### id (`src/utils/id.ts`)
`uid(prefix)` → `prefix-<timestamp>-<random>`-style unique id.

---

## 15. Services

### notification-service (expo-notifications)
- `setNotificationHandler`: show alert + sound + banner + list (badge off).
- `ensureNotificationPermission()`: checks then requests (iOS sound/alert/badge).
- `ensureAlarmChannel()`: Android channel `"event-alarm"`, HIGH importance, vibration `[0,250,250,250,250,250]`, **no custom sound** (falls back to device default notification sound — custom sound files only work in dev builds).
- `scheduleEventReminder(event)`: no-op without `event.reminder`; fire time = start − reminder min; if that time already passed but event hasn't, fire in 10s; cancels previous alarm for the same event (`eventReminderNotifs` map); iOS sound `"default"`; Android trigger `channelId: "event-alarm"`; data `{type:"event-reminder", eventId}`.
- `cancelEventReminder(eventId)`.
- `scheduleTodayReminders()`: for today's events with reminder, on app start.
- `useNotifications()` hook (root + settings): request permission → schedule today's reminders → `addNotificationReceivedListener` (own `event-reminder`/`todo-reminder` notifications → Inbox item `source:"Seishin"`) → Android: `expo-android-notification-listener-service` bridge + response listener.
- `parseNotificationForEvent(data)`: regex time/date from notification text → `pendingEvent`.

### agent-engine + tool-system
- `runAgentLoop(text, {attachments, extractedContext})` — streams assistant text (store `streamTick`), executes tool calls (ToolCollection, JSON args), loops tool→result→response. `stopAgentLoop()` cancels.
- **26 tools**: add/list/update/delete event; add/list/complete/update/delete/clear-completed todo; add/list/update/delete note; list_inbox; generate_invite; get_settings; memory: remember_entity/relation, recall_memory, list_entities, get_related, find_path, update/delete entity, delete_relation.
- System prompt rules: never ask permission, be concise (1–3 sentences), correct typos silently, map wording→tool, resolve relative dates.
- Two providers: **NIM** (OpenAI-compatible REST, streaming; auto-routes small model for simple queries / large model for complex ones via `pickModelForTask` + `detectQueryComplexity`) and **local GGUF** (llama.rn, `loadModel`/`generateResponse`/`abortGeneration`, progress events).

### nim-models
- `categorizeModel(id)` → tier fast/balanced/smart (by name heuristics); `fetchNimModels` (auto-pick pair: recommended + large); `fetchAllNimModels` — **paginated** `/v1/models` (limit 500, `has_more`, `next_page`/`next_cursor`, ≤20 pages, dedupe by id); `cacheNimModels` (settingsStorage `nimCachedModels`).

### ocr (expo-mlkit-ocr)
- `recognizeText(uri)` → text; history cache in `ocrStorage`; `parseScheduleText` extracts date/time/event candidates from text.

### local-llama (llama.rn)
- model lifecycle events, `loadModel(path, onProgress)`, `unloadModel`, `generateResponse` with abort.

### youtube-summary (youtubei.js + react-native-ytdl + NIM)
- `extractVideoId`, `getTranscript` (XML caption parse → segments), `summarizeTranscript` (NIM call), `downloadThumbnail` → file URI.

### agent-memory — persistent knowledge graph
- Entities + relations in `agentStorage`; `addEntity/updateEntity/deleteEntity`, `addRelation/deleteRelation`, `getRelated` (BFS depth 2), `findPath` (shortest), `queryGraph` (search), `getGraphSummary` (top entities/relations for prompt), `getSessionLog`/`appendToSessionLog` (recent conversation for context).

### notification-listener (expo-android-notification-listener-service)
- Bridge for the Android Notification Listener Service: `onNotificationReceived` → `handleNotificationData` → Inbox item + optional `pendingEvent` parse; `openNotificationAccessSettings`.

### Settings-adjacent
- `clearAllStorage`, `getStorageSizes` (see §14).
- `des.ts` — JioSaavn DES decrypt (`decryptSaavnUrl`) — legacy/music-related, not on any screen.

---

## 16. Platform Behaviors & Gotchas (port these!)

1. **Date pickers**: Android → native `DateTimePicker` dialog immediately on state set; iOS → centered `PickerModal` with inline picker + Cancel/Done.
2. **Bottom sheet sizing**: omit `snapPoints` = content auto-fit (used for event form); otherwise fixed percentages. Always `enablePanDownToClose`.
3. **Keyboard**: Android resizes window automatically (`adjustResize`) — never add manual padding there. iOS: add keyboard height as bottom padding (agent input bar).
4. **Event reminder = system notification**: schedule on create/update (dedupe per event id), cancel on delete; permission requested on app start; channel exists for Android 8+; only events *with* a reminder field schedule.
5. **Notes autosave**: instant per keystroke; don't touch `updatedAt` on initial mount for existing notes; flush on unmount.
6. **Draft persistence**: todo + event forms autosave to storage, restored on reopen, cleared on save.
7. **Inbox sanitization on load**: coerce fields; drop items without string `id` (protects against stale/corrupt data).
8. **In-sheet toggles**: the event-detail sheet must observe store changes reactively (subscriptions), not snapshot reads, so checkbox flips live.
9. **Recurrence expansion**: -90 → +366 days window; id = `${eventId}:${dateKey}`; day view via `occursOnDate`.
10. **Calendar height**: 25% of screen (min 168px), collapsible.
11. **Scroll perf props everywhere**: `removeClippedSubviews`, `maxToRenderPerBatch`, `windowSize`, `initialNumToRender` on all FlatLists.
12. **Feather icon set** used exclusively (except tab bar = Ionicons). Sizes 8–24.
13. **Markdown rendering** only for assistant messages; everything else plain text.
14. **Unread styling**: black left border `border-l-[3px] border-l-black` on unread inbox cards; black filled icon bubble.
15. **Empty states** use the medallion EmptyState everywhere.
16. **Confirmations**: always `AlertDialog` (centered), destructive = red text/buttons.
17. **Native alerts** (`Alert.alert`) only for transient errors (YouTube invalid URL, file errors).

---

## 17. Screen/Route Map (expo-router)

```
/                     → (tabs) [bottom tabs]
  /(tabs)/index       → Calendar (event list, add sheet, ItemSheet)
  /(tabs)/notes       → Notes grid + Inbox (toggle)
  /(tabs)/agent       → AI chat
  /(tabs)/settings    → Settings
/todo                 → Todo List (push, slide_from_right)  [?eventId=]
/note                 → Note Editor (push) [?id=, ?eventId=, ?action=camera|photo|file|youtube]
/invites              → Invites (push)
```

Tab bar icons: calendar, document-text, flash, settings (Ionicons; outline variant when inactive).

---

## 18. Port Checklist (Kotlin)

- [ ] 4-tab bottom nav (Calendar/Notes/Agent/Settings)
- [ ] Design tokens: ink ramp, danger `#ff3b30`, success `#2fbf71`, shadows, radii (12/20), tracking -0.02em
- [ ] Calendar: month grid w/ dots, day select + long-press, 25% height collapse, month nav, Today pill
- [ ] Event form: title/date/start/end/repeat/reminder/notes + draft autosave
- [ ] Recurrence engine + -90/+366 expansion
- [ ] System notifications: permission, channel, schedule/cancel per event, 15/30/60 min options, tap → no-op (future: deep link)
- [ ] Todo list + filters + overdue/today pills + event linking
- [ ] Notes grid (2-col, pinned sections, search, tags) + editor (autosave, attachments, OCR, YouTube summary, tags)
- [ ] Inbox (notification listener service on Android, foreground capture, selection mode, Send to AI, Add to Calendar)
- [ ] AI agent chat: streaming, tool calls, 26 tools, NIM + local GGUF, model auto-route tiers, markdown bubbles
- [ ] Knowledge-graph memory (entities/relations/recall)
- [ ] Invites (cards/P2P/shared stubs)
- [ ] Settings: AI config, storage manager, cleanup policies, factory reset
