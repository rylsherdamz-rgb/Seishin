/**
 * Seishin Lite: answers everyday questions about the user's day instantly and
 * offline — the trained intent model picks what was asked, the answer comes
 * from the user's own events and tasks. Anything else goes to the language
 * model (on-device GGUF or NVIDIA NIM).
 */
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { useThemeStore } from "@/stores/theme-store";
import { createLogger } from "@/utils/logger";
import { classify, SOLO_THRESHOLD, THRESHOLD, type Intent } from "./model";
import { answer, type LiteData } from "./answer";

const log = createLogger("seishin-lite");

export interface LiteReply { intent: Intent; confidence: number; text: string }

/**
 * Seishin Lite's reply, or null when the question is for the language model.
 * `hasModel`: whether a GGUF / NIM is available to take over.
 */
export function askLite(text: string, hasModel: boolean, data?: LiteData): LiteReply | null {
  const q = text.trim();
  if (!q || q.length > 200) return null; // long messages are requests, not quick questions
  const c = classify(q);
  // With a model to take over: only sure, personal questions (precision first).
  // Alone: a reasonable best guess beats "I can't help" (chosen on validation in train.py).
  if (c.intent === "other" || c.confidence < (hasModel ? THRESHOLD : SOLO_THRESHOLD)) return null;
  if (hasModel && !c.aboutMe) return null;
  const d = data ?? currentData();
  try {
    const reply = answer(c.intent, q, d);
    return reply ? { intent: c.intent, confidence: c.confidence, text: reply } : null;
  } catch (e) {
    log.warn("answer failed", e);
    return null;
  }
}

function currentData(): LiteData {
  const { timeFormat, weekStart } = useThemeStore.getState();
  return {
    events: useCalendarStore.getState().events,
    todos: useTodoStore.getState().todos,
    now: new Date(),
    timeFormat,
    weekStart,
  };
}

export { HELP as LITE_HELP } from "./answer";
