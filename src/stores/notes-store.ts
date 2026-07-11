import { create } from "zustand";
import { notesStorage } from "./mmkv";

export interface NoteAttachment {
  id: string;
  /** "image" renders as a thumbnail; "file" renders as a chip (Excel, PDF, etc.). */
  type: "image" | "file";
  uri: string;
  name?: string;
  mimeType?: string;
  size?: number;
}

export interface Note {
  id: string;
  title: string;
  body: string;
  tags: string[];
  pinned: boolean;
  /** Photos, Excel/PDF, or any other files attached to the note. */
  attachments: NoteAttachment[];
  /** Optional link to a calendar event this note belongs to. */
  eventId?: string;
  /** Monochrome surface accent for the card (design system inks). */
  color?: string;
  createdAt: string;
  updatedAt: string;
}

interface NoteState {
  notes: Note[];
  query: string;
  loadNotes: () => void;
  addNote: (note: Note) => void;
  updateNote: (id: string, changes: Partial<Note>) => void;
  deleteNote: (id: string) => void;
  togglePin: (id: string) => void;
  setQuery: (query: string) => void;
  getFilteredNotes: () => Note[];
  getNotesForEvent: (eventId: string) => Note[];
}

const NOTES_KEY = "notes";

function persist(notes: Note[]) {
  notesStorage.set(NOTES_KEY, JSON.stringify(notes));
}

// Pinned first, then most recently updated.
function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });
}

export const useNotesStore = create<NoteState>((set, get) => ({
  notes: [],
  query: "",

  loadNotes: () => {
    const raw = notesStorage.getString(NOTES_KEY);
    if (raw) {
      const parsed: Note[] = JSON.parse(raw);
      // Backfill attachments for notes saved before the field existed.
      const normalized = parsed.map((n) => ({ ...n, attachments: n.attachments ?? [] }));
      set({ notes: sortNotes(normalized) });
    }
  },

  addNote: (note) => {
    const notes = sortNotes([note, ...get().notes]);
    persist(notes);
    set({ notes });
  },

  updateNote: (id, changes) => {
    const notes = sortNotes(
      get().notes.map((n) =>
        n.id === id ? { ...n, ...changes, updatedAt: new Date().toISOString() } : n
      )
    );
    persist(notes);
    set({ notes });
  },

  deleteNote: (id) => {
    const notes = get().notes.filter((n) => n.id !== id);
    persist(notes);
    set({ notes });
  },

  togglePin: (id) => {
    const notes = sortNotes(
      get().notes.map((n) =>
        n.id === id ? { ...n, pinned: !n.pinned, updatedAt: new Date().toISOString() } : n
      )
    );
    persist(notes);
    set({ notes });
  },

  setQuery: (query) => set({ query }),

  getFilteredNotes: () => {
    const { notes, query } = get();
    const q = query.trim().toLowerCase();
    if (!q) return notes;
    return notes.filter(
      (n) =>
        n.title.toLowerCase().includes(q) ||
        n.body.toLowerCase().includes(q) ||
        n.tags.some((t) => t.toLowerCase().includes(q))
    );
  },

  getNotesForEvent: (eventId) => get().notes.filter((n) => n.eventId === eventId),
}));
