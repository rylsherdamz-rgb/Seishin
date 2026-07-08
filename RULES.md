# Seishin — Development Rules

## Storage Rules (MMKV)
1. Use MMKV for ALL persistent data. No SQLite, no AsyncStorage.
2. Separate MMKV instance per domain: `new MMKV({ id: 'events' })` etc.
3. All keys follow format: `{domain}:{subdomain}:{id}`
4. CRUD through domain-specific store classes, never raw MMKV.
5. Every store must have `clearAll()` and `getStorageSize()` methods.
6. Serialize complex objects as JSON strings.
7. Catch and handle MMKV write errors.
8. Never store secrets without encryption.

## Serverless Rules
1. NO backend servers of any kind.
2. All P2P: QR pairing → WebRTC for chat/video.
3. WebRTC uses free STUN server only (stun.l.google.com:19302).
4. Messages stored in MMKV, synced P2P when connected.
5. API keys (NVIDIA NIM) are optional — app works fully offline.

## QR + WebRTC Rules
1. QR contains: `seishin://{ip}:{port}/{userId}/{publicKey}`
2. Embedded HTTP server for WebRTC signaling only.
3. Chat over WebRTC DataChannel (reliable, ordered mode).
4. Video over WebRTC MediaTrack.
5. Always handle connection loss and reconnect.

## Agent Rules
1. Agent loop: max 10 iterations per request.
2. Tool calls validated against schema before execution.
3. Providers pluggable via `BaseProvider` interface.
4. Local provider always available; cloud is optional.
5. Dynamic skills validated (JSON schema + sandbox execution).
6. Conversations auto-trimmed to last 100 messages.

## Storage Management Rules
1. Every feature must support periodic data cleanup.
2. Storage screen shows usage per MMKV instance + file system.
3. Clear operations require confirmation with item count.
4. Factory reset clears ALL data + deletes downloaded models.
5. Auto-cleanup runs on launch + every 24 hours.

## UI Rules
1. B&W palette only: #000, #1a1a1a, #333, #666, #999, #ccc, #e5e5e5, #fff.
2. No colors except destructive actions (#ff3b30).
3. System font only, 3 sizes: 14/16/20.
4. 4px spacing grid.
5. Border radius: 0 (default) or 8 (cards/modals).
6. Feather icons, 20px default.
7. Destructive actions require confirmation.

## Code Quality Rules
1. TypeScript strict mode. No `any` — use `unknown` + type guards.
2. Prefer `const` functions over class methods.
3. No console.log in production — use logger with level control.
4. All async with try/catch and user-facing error messages.
5. Components under 200 lines.
6. NativeWind classes only — no StyleSheet.create except for animations.
