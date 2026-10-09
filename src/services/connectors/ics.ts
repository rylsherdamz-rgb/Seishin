/**
 * Minimal, dependency-free iCalendar (RFC 5545) reader for subscription feeds
 * (Canvas, Moodle, Google Classroom, Outlook, school calendars…). Handles
 * line folding, escaping, all-day / UTC / TZID times, DURATION, cancelled
 * events and simple RRULEs. Pure — unit-tested.
 */
import type { Recurrence } from "@/stores/calendar-store";

export interface FeedEvent {
  uid: string;
  title: string;
  description?: string;
  location?: string;
  url?: string;
  start: Date;
  end: Date;
  allDay: boolean;
  recurrence?: Recurrence;
}

interface Prop {
  name: string;
  params: Record<string, string>;
  value: string;
}

function unfold(text: string): string[] {
  return text.replace(/\r\n/g, "\n").replace(/\n[ \t]/g, "").split("\n");
}

function parseLine(line: string): Prop | null {
  // NAME;PARAM=a;PARAM2="b:c":VALUE — the first colon outside quotes splits.
  let inQuote = false;
  let split = -1;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') inQuote = !inQuote;
    else if (ch === ":" && !inQuote) { split = i; break; }
  }
  if (split < 0) return null;
  const [name, ...rawParams] = line.slice(0, split).split(";");
  const params: Record<string, string> = {};
  for (const p of rawParams) {
    const eq = p.indexOf("=");
    if (eq > 0) params[p.slice(0, eq).toUpperCase()] = p.slice(eq + 1).replace(/^"|"$/g, "");
  }
  return { name: name.toUpperCase(), params, value: line.slice(split + 1) };
}

export function unescapeText(v: string): string {
  return v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();
}

/** Wall-clock time in an IANA zone → UTC instant (via Intl; falls back to device-local). */
function zonedToUtc(y: number, mo: number, d: number, h: number, mi: number, s: number, tz?: string): Date {
  const asUtc = Date.UTC(y, mo, d, h, mi, s);
  if (!tz) return new Date(y, mo, d, h, mi, s);
  try {
    const fmt = new Intl.DateTimeFormat("en-US", {
      timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
    const parts = Object.fromEntries(fmt.formatToParts(new Date(asUtc)).map((p) => [p.type, p.value]));
    const seen = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
    return new Date(asUtc - (seen - asUtc));
  } catch {
    return new Date(y, mo, d, h, mi, s);
  }
}

export function parseIcsDate(value: string, params: Record<string, string>): { date: Date; allDay: boolean } | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (!h || params.VALUE === "DATE") return { date: new Date(+y, +mo - 1, +d), allDay: true };
  if (z) return { date: new Date(Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0))), allDay: false };
  return { date: zonedToUtc(+y, +mo - 1, +d, +h, +mi, +(s ?? 0), params.TZID), allDay: false };
}

/** ISO-8601 duration (P1D, PT1H30M, P1W) in ms. */
export function parseDuration(v: string): number | null {
  const m = v.match(/^([+-])?P(?:(\d+)W)?(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/);
  if (!m) return null;
  const [, sign, w, d, h, mi, s] = m;
  const ms = ((+(w ?? 0) * 7 + +(d ?? 0)) * 86400 + +(h ?? 0) * 3600 + +(mi ?? 0) * 60 + +(s ?? 0)) * 1000;
  return sign === "-" ? -ms : ms;
}

const DAY_CODES = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

/** Map the RRULEs Seishin can represent; anything else → undefined (first occurrence only). */
export function parseRrule(v: string): Recurrence | undefined {
  const r = Object.fromEntries(v.split(";").map((kv) => kv.split("=")).filter((x) => x.length === 2).map(([k, val]) => [k.toUpperCase(), val]));
  const freq = (r.FREQ ?? "").toLowerCase();
  if (freq !== "daily" && freq !== "weekly" && freq !== "monthly") return undefined;
  if (r.COUNT) return undefined; // count-bounded series aren't representable; avoid infinite repeats
  const rec: Recurrence = { frequency: freq, interval: r.INTERVAL ? Math.max(1, +r.INTERVAL) : 1 };
  if (freq === "weekly" && r.BYDAY) {
    const days = r.BYDAY.split(",").map((d: string) => DAY_CODES.indexOf(d.replace(/^[+-]?\d+/, ""))).filter((n: number) => n >= 0);
    if (days.length) rec.weekdays = [...new Set<number>(days)].sort();
  }
  if (r.UNTIL) {
    const u = r.UNTIL.match(/^(\d{4})(\d{2})(\d{2})/);
    if (u) rec.until = `${u[1]}-${u[2]}-${u[3]}`;
  }
  return rec;
}

export function parseIcs(text: string): FeedEvent[] {
  const out: FeedEvent[] = [];
  let cur: Prop[] | null = null;
  for (const line of unfold(text)) {
    if (line === "BEGIN:VEVENT") { cur = []; continue; }
    if (line === "END:VEVENT") {
      if (cur) {
        const ev = toEvent(cur);
        if (ev) out.push(ev);
      }
      cur = null;
      continue;
    }
    if (cur) {
      const p = parseLine(line);
      if (p) cur.push(p);
    }
  }
  return out;
}

function toEvent(props: Prop[]): FeedEvent | null {
  const get = (n: string) => props.find((p) => p.name === n);
  // Modified single occurrences of a series would duplicate the series; skip.
  if (get("RECURRENCE-ID")) return null;
  if ((get("STATUS")?.value ?? "").toUpperCase() === "CANCELLED") return null;
  const ds = get("DTSTART");
  const start = ds ? parseIcsDate(ds.value, ds.params) : null;
  if (!start) return null;
  let end: Date | null = null;
  const de = get("DTEND") ?? get("DUE");
  if (de) end = parseIcsDate(de.value, de.params)?.date ?? null;
  const dur = get("DURATION");
  if (!end && dur) {
    const ms = parseDuration(dur.value);
    if (ms !== null) end = new Date(start.date.getTime() + ms);
  }
  if (!end || end <= start.date) end = new Date(start.date.getTime() + (start.allDay ? 86400000 : 3600000));
  const uid = get("UID")?.value || `${get("SUMMARY")?.value ?? ""}-${ds!.value}`;
  const rr = get("RRULE");
  return {
    uid,
    title: unescapeText(get("SUMMARY")?.value ?? "") || "(No title)",
    description: get("DESCRIPTION") ? unescapeText(get("DESCRIPTION")!.value).slice(0, 4000) : undefined,
    location: get("LOCATION") ? unescapeText(get("LOCATION")!.value) : undefined,
    url: get("URL")?.value,
    start: start.date,
    // All-day DTEND is exclusive; keep the event within its own day(s).
    end: start.allDay ? new Date(end.getTime() - 60000) : end,
    allDay: start.allDay,
    recurrence: rr ? parseRrule(rr.value) : undefined,
  };
}

/** Heuristic: is this feed entry a deadline (Canvas/Moodle "… due", "Assignment …")? */
export function looksLikeDeadline(e: FeedEvent): boolean {
  return /\b(due|deadline|submission|submit|assignment|quiz|exam|homework|activity)\b/i.test(`${e.title} ${e.description ?? ""}`);
}
