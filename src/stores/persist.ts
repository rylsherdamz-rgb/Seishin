import { createLogger } from "@/utils/logger";

const log = createLogger("storage");

/** Minimal storage surface shared by MMKV instances (and the jest mock). */
export interface KeyValueStore {
  getString: (key: string) => string | undefined | null;
  set: (key: string, value: string) => void;
  remove: (key: string) => unknown;
}

/**
 * Read a JSON array, keeping only items that pass `isValid`. Corrupt JSON or
 * malformed records never crash the app; they're dropped and logged.
 */
export function readList<T>(store: KeyValueStore, key: string, isValid: (x: unknown) => x is T): T[] {
  let raw: string | undefined | null;
  try {
    raw = store.getString(key);
  } catch (e) {
    log.error(`read failed for ${key}`, e);
    return [];
  }
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) {
      log.warn(`${key} is not a list; ignoring`);
      return [];
    }
    const valid = parsed.filter(isValid);
    if (valid.length !== parsed.length) log.warn(`${key}: dropped ${parsed.length - valid.length} malformed record(s)`);
    return valid;
  } catch (e) {
    log.error(`${key} is corrupt; starting empty`, e);
    return [];
  }
}

/** Persist JSON; returns false (and logs) when the write fails. */
export function writeJSON(store: KeyValueStore, key: string, value: unknown): boolean {
  try {
    store.set(key, JSON.stringify(value));
    return true;
  } catch (e) {
    log.error(`write failed for ${key}`, e);
    return false;
  }
}

/** Approximate bytes held under `key` (UTF-16 → treat as 1 byte/char for JSON). */
export function sizeOf(store: KeyValueStore, key: string): number {
  try {
    return store.getString(key)?.length ?? 0;
  } catch {
    return 0;
  }
}

export const isRecord = (x: unknown): x is Record<string, unknown> =>
  typeof x === "object" && x !== null && !Array.isArray(x);

export const isNonEmptyString = (x: unknown): x is string => typeof x === "string" && x.length > 0;
