# Play Store assets

Everything for the Seishin store listing, captured from the real app (release
build, Infinix X6812B) over adb with sample data — no personal data.

## Screenshots — `screenshots/`

1116×2232 PNG, status/navigation bars cropped, exactly 2:1 (Play's limit).
Upload in this order (Play shows the first 3–4 most):

| File | Shows |
|---|---|
| 01-calendar.png | Today timeline with tasks strip |
| 03-tasks.png | Tasks grouped Overdue / Today / Upcoming |
| 04-add-task.png | Quick add with date chips |
| 02-agenda.png | Agenda view |
| 05-task-detail.png | Checklist task with progress and reminders |
| 06-notes.png | Coloured notes grid |
| 07-alarm.png | Full-screen event alarm |
| 08-themes.png | Themes and accent colours |
| 11-dark-mode.png | Midnight theme |
| 09-upcoming.png, 10-note.png | Spares |

## Promo video — `video/seishin-promo.mp4`

27 s, 1920×1080, 30 fps, silent (no music source was available). Play only
accepts a YouTube link: upload it to YouTube (Unlisted is fine) and paste the
URL in Play Console → Main store listing → Video.

- `video/raw/` — the untouched adb screen recordings.
- `video/promo/` — the HyperFrames source. Edit copy in `index.html` /
  `compositions/*.html`, then `cd store/video/promo && npx hyperframes render --output ../seishin-promo.mp4`.
  To add music: drop a track in `promo/assets/` and add an `<audio id="music" class="clip" src="assets/…" data-start="0" data-volume="0.8" data-fade-out="1.5">` to `index.html`.

## Re-capturing

1. Back up your real data (Settings → Backup & restore; open the Notes tab first on builds before 2026-10-22).
2. **Disconnect calendar sync** (Connectors) — otherwise demo data is copied into your Google Calendar.
3. `node scripts/demo-backup.mjs` → restore it with *Replace all*.
4. `scripts/store/capture.sh demo-on`, then `shot <name>` / `record <name> <secs>`.
5. Restore your own backup, reconnect calendars.
