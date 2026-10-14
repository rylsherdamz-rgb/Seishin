/**
 * Native side of event alarms: turns the plan from event-alarm-plan.ts into
 * scheduled notifications, keeping one notification per occurrence in a map
 * so re-running never stacks duplicates and only changed alarms are touched.
 */
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import { settingsStorage } from "@/stores/mmkv";
import type { CalendarEvent } from "@/stores/calendar-store";
import { createLogger } from "@/utils/logger";
import { NativeAlarm, ALARM_CHANNEL, REMINDER_CHANNEL, ensureEventChannels, ensureNotificationPermission } from "./notify-core";
import { catchUpSlot, isPendingLate, parseRecord, planEventAlarms, type AlarmSlot } from "./event-alarm-plan";

const log = createLogger("event-alarms");
const MAP_KEY = "eventReminderNotifs";

type IdMap = Record<string, string>;

function readMap(): IdMap {
  try {
    const raw = settingsStorage.getString(MAP_KEY);
    return raw ? (JSON.parse(raw) as IdMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: IdMap) {
  try {
    settingsStorage.set(MAP_KEY, JSON.stringify(map));
  } catch (e) {
    log.error("could not persist alarm ids", e);
  }
}

const fmtTime = (d: Date) => d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

async function schedule(slot: AlarmSlot): Promise<string> {
  const range = slot.end ? `${fmtTime(slot.occurrence)} – ${fmtTime(slot.end)}` : fmtTime(slot.occurrence);
  const alarm = slot.kind === "alarm";
  const id = await Notifications.scheduleNotificationAsync({
    content: {
      title: slot.title,
      body: slot.notes ? `${range}\n${slot.notes}` : range,
      sound: Platform.OS === "ios" ? "default" : undefined,
      data: {
        type: alarm ? "event-alarm" : "event-reminder",
        eventId: slot.eventId,
        startTime: slot.occurrence.toISOString(),
        endTime: slot.end?.toISOString(),
        notes: slot.notes || undefined,
      },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: slot.fireAt,
      channelId: Platform.OS === "android" ? (alarm ? ALARM_CHANNEL : REMINDER_CHANNEL) : undefined,
    },
  });
  if (alarm) {
    try {
      NativeAlarm?.scheduleAlarm(slot.key, slot.title, range, slot.occurrence.getTime(), slot.fireAt.getTime(), id, slot.end?.getTime() ?? 0, slot.notes);
    } catch { /* optional native module */ }
  }
  return id;
}

async function cancelKey(map: IdMap, key: string) {
  try { await Notifications.cancelScheduledNotificationAsync(parseRecord(map[key]).id); } catch { /* already fired */ }
  try { NativeAlarm?.cancelAlarms(key); } catch { /* optional native module */ }
  delete map[key];
}

async function apply(map: IdMap, slots: AlarmSlot[]): Promise<number> {
  let n = 0;
  for (const s of slots) {
    const cur = map[s.key];
    if (cur && parseRecord(cur).sig === s.sig) continue;
    if (cur) await cancelKey(map, s.key);
    try {
      map[s.key] = `${await schedule(s)}|${s.sig}`;
      n++;
    } catch (e) {
      log.warn("schedule failed", s.key, e);
    }
  }
  return n;
}

let running: Promise<number> | null = null;

/**
 * Bring every event's alarms in line with the plan: schedules what's missing
 * or changed, cancels what's gone (deleted, moved, already fired). Run on
 * launch, after each sync and from the background task.
 */
export function refreshEventAlarms(events: CalendarEvent[], now = new Date()): Promise<number> {
  if (running) return running;
  running = (async () => {
    if (!(await ensureNotificationPermission())) return 0;
    await ensureEventChannels();
    const plan = planEventAlarms(events, now);
    const keep = new Set(plan.map((s) => s.key));
    const map = readMap();
    for (const key of Object.keys(map)) {
      if (!keep.has(key) && !isPendingLate(parseRecord(map[key]).sig, now)) await cancelKey(map, key);
    }
    const n = await apply(map, plan);
    writeMap(map);
    return n;
  })().finally(() => { running = null; });
  return running;
}

/** Cancel every alarm of one event (deleted, or reminder turned off). */
export async function cancelEventReminder(eventId: string): Promise<void> {
  const map = readMap();
  const prefix = `${eventId}:`;
  const keys = Object.keys(map).filter((k) => k === eventId || k.startsWith(prefix));
  for (const k of keys) await cancelKey(map, k);
  if (keys.length) writeMap(map);
  try { NativeAlarm?.cancelAlarms(eventId); } catch { /* optional native module */ }
}

/** Schedule one event right after it's added or edited (recurring: next 30 days). */
export async function scheduleEventReminder(event: CalendarEvent, now = new Date()): Promise<void> {
  await cancelEventReminder(event.id);
  if (!event.reminder) return;
  if (!(await ensureNotificationPermission())) return;
  await ensureEventChannels();
  const slots = planEventAlarms([event], now, { horizonDays: 30, max: 60 });
  const late = catchUpSlot(event, now);
  if (late) slots.unshift(late);
  const map = readMap();
  await apply(map, slots);
  writeMap(map);
}
