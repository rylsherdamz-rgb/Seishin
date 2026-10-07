import { launchImageLibraryAsync } from "expo-image-picker";
import { useCalendarStore } from "@/stores/calendar-store";
import { useTodoStore } from "@/stores/todo-store";
import { recognizeText } from "@/services/ocr";
import { uid } from "@/utils/id";
import { LIMITS } from "@/constants/copy";
import { atMinutes, nextSlotMinutes, type QuickParse } from "./calendar-utils";

export type CreateKind = "event" | "todo";

/** Create an event or task straight from a parsed quick-add line. */
export function quickCreate(kind: CreateKind, p: QuickParse, today: string): boolean {
  const title = p.title.slice(0, LIMITS.title);
  if (!title) return false;
  if (kind === "todo") {
    return useTodoStore.getState().addTodo({
      id: uid("todo"), title, completed: false, priority: "medium", category: "general", tags: [],
      createdAt: new Date().toISOString(),
      // Noon local keeps the due day stable across UTC offsets.
      dueDate: atMinutes(p.date, 12 * 60).toISOString(),
    });
  }
  const start = atMinutes(p.date, p.minutes ?? (p.date === today ? nextSlotMinutes() : 9 * 60));
  const end = new Date(start.getTime() + (p.duration ?? 60) * 60000);
  return useCalendarStore.getState().addEvent({
    id: uid("manual-evt"), title, startDate: start.toISOString(), endDate: end.toISOString(), source: "manual",
  });
}

/**
 * Let the user pick a photo and OCR it. Resolves `null` when cancelled;
 * throws when the image has no readable text.
 */
export async function pickAndReadText(onReading?: () => void): Promise<{ title: string; text: string } | null> {
  const res = await launchImageLibraryAsync({ mediaTypes: ["images"], quality: 0.8 });
  if (res.canceled || !res.assets[0]) return null;
  onReading?.();
  const text = (await recognizeText(res.assets[0].uri)).trim().slice(0, LIMITS.notes);
  if (!text) throw new Error("No text found");
  const title = text.split("\n").find((l) => l.trim())?.trim().slice(0, 60) ?? "";
  return { title, text };
}
