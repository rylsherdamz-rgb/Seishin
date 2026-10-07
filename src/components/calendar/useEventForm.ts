import { useCallback, useEffect, useRef, useState } from "react";
import { Alert } from "react-native";
import { launchCameraAsync, launchImageLibraryAsync } from "expo-image-picker";
import { useCalendarStore, type Recurrence } from "@/stores/calendar-store";
import type { NoteAttachment } from "@/stores/notes-store";
import { recognizeText } from "@/services/ocr";
import { uid } from "@/utils/id";
import { dateKey } from "@/utils/recurrence";
import { loadEventDraft, saveEventDraft, clearEventDraft } from "@/utils/drafts";
import { atMinutes, buildRecurrence, recurrenceToState, type RepeatMode } from "./calendar-utils";

export interface EventPrefill {
  /** Set when editing an existing event. */
  editingId?: string;
  title?: string;
  notes?: string;
  start: Date;
  end?: Date;
  allDay?: boolean;
  recurrence?: Recurrence;
  reminder?: number;
  attachments?: NoteAttachment[];
  /** Restore the user's last unsaved new-event draft. */
  fromDraft?: boolean;
}

const mins = (d: Date) => d.getHours() * 60 + d.getMinutes();

function resolvePrefill(p: EventPrefill): EventPrefill {
  if (!p.fromDraft || p.editingId) return p;
  const draft = loadEventDraft();
  // An empty draft would only drag in a stale date — start fresh instead.
  if (!draft.title && !draft.notes) return p;
  const start = draft.startDate ? new Date(draft.startDate) : p.start;
  const end = draft.endDate ? new Date(draft.endDate) : undefined;
  const ok = (d?: Date) => d && !isNaN(d.getTime());
  return {
    ...p,
    title: draft.title || p.title,
    notes: draft.notes || p.notes,
    start: ok(start) ? start : p.start,
    end: ok(end) ? end : p.end,
    allDay: draft.allDay ?? p.allDay,
    recurrence: buildRecurrence((draft.repeatMode as RepeatMode) ?? "none", draft.customWeekdays ?? []),
    reminder: draft.reminderMinutes ?? p.reminder,
  };
}

export function useEventForm(prefill: EventPrefill) {
  const [init] = useState(() => resolvePrefill(prefill));
  const [title, setTitle] = useState(init.title ?? "");
  const [notes, setNotes] = useState(init.notes ?? "");
  const [date, setDate] = useState(init.start);
  const [startMin, setStartMin] = useState(mins(init.start));
  const [endMin, setEndMin] = useState(init.end ? mins(init.end) : Math.min(mins(init.start) + 60, 24 * 60 - 1));
  const [allDay, setAllDay] = useState(!!init.allDay);
  const [repeat, setRepeat] = useState(() => recurrenceToState(init.recurrence));
  const [reminder, setReminder] = useState(init.reminder ?? 0);
  const [attachments, setAttachments] = useState<NoteAttachment[]>(init.attachments ?? []);
  const [ocrBusy, setOcrBusy] = useState(false);
  const editingId = init.editingId;
  // Once saved, closing the sheet must not resurrect the cleared draft.
  const savedRef = useRef(false);

  const duration = (endMin - startMin + 24 * 60) % (24 * 60) || 24 * 60;

  /** Moving the start keeps the duration, like every good calendar app. */
  const changeStart = useCallback((m: number) => {
    setEndMin((e) => (m + ((e - startMin + 1440) % 1440 || 60)) % 1440);
    setStartMin(m);
  }, [startMin]);

  const setDuration = useCallback((d: number) => setEndMin((startMin + d) % 1440), [startMin]);

  const buildTimes = useCallback(() => {
    const key = dateKey(date);
    if (allDay) return { start: atMinutes(key, 0), end: atMinutes(key, 23 * 60 + 59) };
    const start = atMinutes(key, startMin);
    const end = atMinutes(key, endMin);
    if (end <= start) end.setDate(end.getDate() + 1); // crosses midnight
    return { start, end };
  }, [date, allDay, startMin, endMin]);

  // Autosave new-event drafts (debounced) so closing the sheet loses nothing.
  const flushDraft = useCallback(() => {
    if (editingId || savedRef.current) return;
    const { start, end } = buildTimes();
    saveEventDraft({
      title, notes, allDay,
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      repeatMode: repeat.mode === "none" ? undefined : repeat.mode,
      customWeekdays: repeat.weekdays.length ? repeat.weekdays : undefined,
      reminderMinutes: reminder || undefined,
    });
  }, [editingId, buildTimes, title, notes, allDay, repeat, reminder]);

  useEffect(() => {
    const t = setTimeout(flushDraft, 300);
    return () => clearTimeout(t);
  }, [flushDraft]);

  const addEvent = useCalendarStore((s) => s.addEvent);
  const updateEvent = useCalendarStore((s) => s.updateEvent);

  const save = useCallback((): boolean => {
    if (!title.trim()) return false;
    const { start, end } = buildTimes();
    const changes = {
      title: title.trim(),
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      allDay: allDay || undefined,
      notes: notes.trim() || undefined,
      attachments: attachments.length ? attachments : undefined,
      recurrence: buildRecurrence(repeat.mode, repeat.weekdays),
      reminder: reminder > 0 ? reminder : undefined,
    };
    try {
      if (editingId) updateEvent(editingId, changes);
      else {
        addEvent({ id: uid("manual-evt"), ...changes, source: "manual" });
        clearEventDraft();
      }
      savedRef.current = true;
      return true;
    } catch {
      Alert.alert("Couldn't save", "Something went wrong saving this event. Please try again.");
      return false;
    }
  }, [title, buildTimes, allDay, notes, attachments, repeat, reminder, editingId, addEvent, updateEvent]);

  const pickImage = useCallback(async (fromCamera: boolean) => {
    const picker = fromCamera ? launchCameraAsync : launchImageLibraryAsync;
    try {
      const res = await picker({ mediaTypes: ["images"], quality: 0.8 });
      return res.canceled ? null : res.assets[0] ?? null;
    } catch {
      Alert.alert("Unavailable", "Could not open the picker. Check app permissions and try again.");
      return null;
    }
  }, []);

  const attach = useCallback(async (fromCamera: boolean) => {
    const a = await pickImage(fromCamera);
    if (!a) return;
    setAttachments((prev) => [...prev, {
      id: uid("att"), type: "image", uri: a.uri,
      name: a.fileName ?? undefined, mimeType: a.mimeType ?? "image/*", size: a.fileSize,
    }]);
  }, [pickImage]);

  const scan = useCallback(async () => {
    const a = await pickImage(false);
    if (!a) return;
    setOcrBusy(true);
    try {
      const text = (await recognizeText(a.uri)).trim();
      if (text) setNotes((prev) => (prev ? `${prev}\n\n${text}` : text));
    } catch {
      Alert.alert("Scan failed", "Couldn't read text from that image.");
    } finally {
      setOcrBusy(false);
    }
  }, [pickImage]);

  const toggleWeekday = useCallback((d: number) => {
    setRepeat((r) => {
      const wd = r.weekdays.includes(d) ? r.weekdays.filter((x) => x !== d) : [...r.weekdays, d].sort();
      return { mode: "custom", weekdays: wd };
    });
  }, []);

  return {
    editingId, title, setTitle, notes, setNotes, date, setDate,
    startMin, endMin, changeStart, setEndMin, duration, setDuration,
    allDay, setAllDay, repeat, setRepeat, toggleWeekday, reminder, setReminder,
    attachments, setAttachments, ocrBusy, attach, scan, save, flushDraft,
  };
}
