/**
 * Native side of task reminders: schedules the plan from reminder-plan.ts as
 * local notifications with "Mark done" / "Remind me in 1 hour" actions, and
 * tops every open task's schedule up on launch so persistent reminders never
 * run dry while the task is still open.
 */
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { todosStorage } from "@/stores/mmkv";
import type { Todo } from "@/stores/todo-store";
import { planReminders, type ReminderLevel } from "./reminder-plan";
import { createLogger } from "@/utils/logger";

const log = createLogger("task-reminders");

const MAP_KEY = "todos:reminders:map";
const CHANNEL = "task-reminders";
export const TASK_CATEGORY = "task-nag";
export const ACTION_DONE = "done";
export const ACTION_SNOOZE = "snooze";

type IdMap = Record<string, string[]>;

function readMap(): IdMap {
  try {
    const raw = todosStorage.getString(MAP_KEY);
    return raw ? (JSON.parse(raw) as IdMap) : {};
  } catch {
    return {};
  }
}

function writeMap(map: IdMap) {
  try {
    todosStorage.set(MAP_KEY, JSON.stringify(map));
  } catch (e) {
    log.error("could not persist reminder ids", e);
  }
}

/** Channel + action buttons. Safe to call repeatedly. */
export async function setupTaskReminders(): Promise<void> {
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CHANNEL, {
        name: "Task reminders",
        description: "Deadlines and persistent reminders for open tasks",
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 200, 120, 200],
      });
    }
    await Notifications.setNotificationCategoryAsync(TASK_CATEGORY, [
      { identifier: ACTION_DONE, buttonTitle: "Mark done", options: { opensAppToForeground: true } },
      { identifier: ACTION_SNOOZE, buttonTitle: "Remind me in 1 hour", options: { opensAppToForeground: true } },
    ]);
  } catch (e) {
    log.warn("setup failed", e);
  }
}

export function levelOf(t: Todo): ReminderLevel {
  return t.reminder ?? (t.dueDate ? "normal" : "off");
}

function bodyFor(t: Todo): string {
  const open = t.items?.filter((i) => !i.done).length ?? 0;
  const parts = [t.title];
  if (open) parts.push(`${open} item${open > 1 ? "s" : ""} left to answer`);
  return parts.join(" · ");
}

export async function cancelTaskReminders(todoId: string): Promise<void> {
  const map = readMap();
  const ids = map[todoId] ?? [];
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  delete map[todoId];
  writeMap(map);
}

/** (Re)schedule a task's reminders from scratch; cancels when done/off. */
export async function scheduleTaskReminders(t: Todo, now = new Date()): Promise<number> {
  await cancelTaskReminders(t.id);
  if (t.completed) return 0;
  const due = t.dueDate ? new Date(t.dueDate) : null;
  const plan = planReminders(due && !isNaN(due.getTime()) ? due : null, now, levelOf(t));
  if (plan.length === 0) return 0;
  const ids: string[] = [];
  for (const p of plan) {
    try {
      const id = await Notifications.scheduleNotificationAsync({
        content: {
          title: p.title,
          body: bodyFor(t),
          categoryIdentifier: TASK_CATEGORY,
          data: { type: "task-nag", todoId: t.id },
          sound: true,
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: p.at,
          channelId: Platform.OS === "android" ? CHANNEL : undefined,
        },
      });
      ids.push(id);
    } catch (e) {
      log.warn("schedule failed", e);
      break;
    }
  }
  const map = readMap();
  map[t.id] = ids;
  writeMap(map);
  return ids.length;
}

/** One extra reminder an hour from now (notification "snooze" action). */
export async function snoozeTask(t: Todo, minutes = 60): Promise<void> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: "Reminder",
        body: bodyFor(t),
        categoryIdentifier: TASK_CATEGORY,
        data: { type: "task-nag", todoId: t.id },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: new Date(Date.now() + minutes * 60000),
        channelId: Platform.OS === "android" ? CHANNEL : undefined,
      },
    });
    const map = readMap();
    map[t.id] = [...(map[t.id] ?? []), id];
    writeMap(map);
  } catch (e) {
    log.warn("snooze failed", e);
  }
}

/**
 * Rolling top-up, run on launch: reschedules every open task with reminders
 * from "now", extending persistent schedules and dropping finished ones.
 */
export async function refreshAllTaskReminders(todos: Todo[]): Promise<void> {
  await setupTaskReminders();
  const map = readMap();
  for (const id of Object.keys(map)) {
    const t = todos.find((x) => x.id === id);
    if (!t || t.completed) await cancelTaskReminders(id);
  }
  for (const t of todos) {
    if (!t.completed && levelOf(t) !== "off") await scheduleTaskReminders(t);
  }
}
