/**
 * User-facing copy. One place for wording so terminology stays consistent:
 *   Event — something scheduled at a time (calendar).
 *   Task  — something to do, optionally due on a day (never "todo" in the UI).
 *   Note  — freeform text with attachments.
 * Sentence case everywhere; no trailing periods on labels or buttons.
 */
export const COPY = {
  terms: {
    event: "Event",
    events: "Events",
    task: "Task",
    tasks: "Tasks",
    note: "Note",
  },

  calendar: {
    views: { day: "Timeline", list: "Agenda", upcoming: "Upcoming" },
    today: "Today",
    toggleMonth: "Show or hide month",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    allDayAndTasks: "ALL DAY · TASKS",
    allDay: "All day",
    freeDay: "No plans yet",
    booked: (d: string) => `${d} scheduled`,
    eventCount: (n: number) => `${n} ${n === 1 ? "event" : "events"}`,
    taskProgress: (done: number, total: number) => `${done} of ${total} ${total === 1 ? "task" : "tasks"} done`,
    emptyDayTitle: "Nothing planned",
    emptyDaySubtitle: "Tap + to add an event or task, or press and hold a date.",
    emptyUpcomingTitle: "Nothing coming up",
    emptyUpcomingSubtitle: "The next 60 days are clear. Tap + to plan ahead.",
    priorityHigh: "HIGH",
    scanning: "Reading text from image…",
    createFab: "Create event, task or note",
  },

  create: {
    title: "Create",
    subtitle: (day: string) => `For ${day} · try “Gym tomorrow 6pm for 1h”`,
    quickEventPlaceholder: "Add an event…",
    quickTaskPlaceholder: "Add a task…",
    quickAddLabel: "Add",
    tiles: {
      event: { label: "Event", hint: "Date, time & repeat" },
      task: { label: "Task", hint: "Your task list" },
      note: { label: "Note", hint: "Text, photos & files" },
      scan: { label: "Scan", hint: "Photo to event" },
    },
    quickBlocks: "QUICK BLOCKS",
  },

  form: {
    newTitle: "New event",
    editTitle: "Edit event",
    titlePlaceholder: "Event title",
    save: "Save",
    saveNew: "Add event",
    saveEdit: "Save changes",
    close: "Close",
    allDay: "All day",
    date: "DATE",
    starts: "STARTS",
    ends: "ENDS",
    endsNextDay: "Ends the next day",
    duration: "DURATION",
    repeat: "REPEAT",
    reminder: "REMINDER",
    notes: "NOTES & ATTACHMENTS",
    notesPlaceholder: "Add notes, links or an agenda",
    camera: "Camera",
    photo: "Photo",
    scanText: "Scan text",
    removeAttachment: "Remove attachment",
    selectDate: "Select date",
    startTime: "Start time",
    endTime: "End time",
    readingImage: "Reading text from image…",
  },

  appearance: {
    accent: "Accent color",
    system: "System",
  },

  errors: {
    saveFailedTitle: "Couldn't save",
    saveEventFailed: "Your event wasn't saved. Check the date and time, then try again.",
    saveTaskFailed: "Your task wasn't saved. Please try again.",
    deleteFailed: "Couldn't delete this item. Please try again.",
    scanFailedTitle: "Couldn't read image",
    scanFailed: "No text could be read from that image. Try a sharper, well-lit photo.",
    pickerUnavailableTitle: "Can't open photos",
    pickerUnavailable: "Allow photo and camera access in system settings, then try again.",
  },
} as const;

/** Input limits — keep storage bounded and the UI legible. */
export const LIMITS = {
  title: 120,
  notes: 5000,
  attachments: 10,
} as const;
