import { useNotesStore, type NoteAttachment } from "@/stores/notes-store";
import { useTodoStore } from "@/stores/todo-store";
import { useCalendarStore } from "@/stores/calendar-store";
import { uid } from "@/utils/id";
import type { NoteColorId } from "@/theme/note-colors";
import { KIND_LABELS } from "@/services/capture-analyzer";
import type { ReviewState } from "./CaptureReview";

export interface CapturedFile {
  uri: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

const KIND_COLOR: Partial<Record<ReviewState["kind"], NoteColorId>> = {
  assignment: "lemon", exam: "rose", event: "sky", reading: "mint",
};

/** Due date as stored: the picked time, or 23:59 when only a day was set. */
export function resolveDue(v: ReviewState): Date | null {
  if (!v.due) return null;
  const d = new Date(v.due);
  if (!v.dueHasTime) d.setHours(23, 59, 0, 0);
  return d;
}

function noteBody(v: ReviewState, text: string): string {
  const parts: string[] = [];
  const due = resolveDue(v);
  if (due) parts.push(`Due ${due.toLocaleString(undefined, { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`);
  if (v.items.length) parts.push(`To answer:\n${v.items.map((i, n) => `${n + 1}. ${i}`).join("\n")}`);
  if (text.trim()) parts.push(`— Scanned text —\n${text.trim()}`);
  return parts.join("\n\n").slice(0, 20000);
}

/** Persist a reviewed capture. Returns the new task id (or null for note-only). */
export function saveCapture(v: ReviewState, files: CapturedFile[], text: string): { todoId: string | null; noteId: string } {
  const now = new Date().toISOString();
  const due = resolveDue(v);
  const title = v.title.trim() || KIND_LABELS[v.kind];
  const subject = v.subject.trim() || undefined;

  const attachments: NoteAttachment[] = files.map((f) => ({
    id: uid("att"),
    type: (f.mimeType ?? "image/").startsWith("image/") ? "image" : "file",
    uri: f.uri,
    name: f.name,
    mimeType: f.mimeType,
    size: f.size,
  }));
  const noteId = uid("note");
  useNotesStore.getState().addNote({
    id: noteId,
    title,
    body: noteBody(v, text),
    tags: [v.kind, ...(subject ? [subject.toLowerCase()] : [])],
    pinned: v.kind === "assignment" || v.kind === "exam",
    attachments,
    color: KIND_COLOR[v.kind],
    createdAt: now,
    updatedAt: now,
  });

  let eventId: string | undefined;
  if (due && (v.kind === "exam" || v.kind === "event")) {
    eventId = uid("capture-evt");
    const end = new Date(due.getTime() + 3600000);
    useCalendarStore.getState().addEvent({
      id: eventId,
      title,
      startDate: due.toISOString(),
      endDate: end.toISOString(),
      allDay: !v.dueHasTime || undefined,
      notes: subject,
      source: "ocr",
    });
  }

  // Reading material and "other" with no reminders are kept as a note only.
  if (v.reminder === "off" && !due && v.items.length === 0) return { todoId: null, noteId };

  const todoId = uid("todo");
  const soon = due ? due.getTime() - Date.now() < 3 * 86400000 : false;
  useTodoStore.getState().addTodo({
    id: todoId,
    title,
    completed: false,
    dueDate: due?.toISOString(),
    priority: v.kind === "exam" || soon ? "high" : "medium",
    category: v.kind,
    tags: subject ? [subject] : [],
    createdAt: now,
    items: v.items.map((text) => ({ id: uid("item"), text, done: false })),
    reminder: v.reminder,
    noteId,
    subject,
    eventId,
  });
  return { todoId, noteId };
}
