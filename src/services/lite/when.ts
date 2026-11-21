/**
 * Dates and times in a question, English and Tagalog ("bukas", "sa Biyernes",
 * "ngayong linggo", "alas tres", "nov 25", "3:30pm"). Pure rules — a model
 * guessing at dates is the wrong tool. Everything is local time.
 */
import { fold } from "./features";

export interface DayRange {
  /** First and last day, local midnight. */
  from: Date;
  to: Date;
  /** "today", "tomorrow", "Friday", "this week", "Nov 25" … */
  label: string;
  /** False when nothing in the question named a day (we assumed today). */
  explicit: boolean;
}

export interface TimeOfDay { h: number; m: number }

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

const WEEKDAY: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, lunes: 1, tuesday: 2, tue: 2, tues: 2, martes: 2,
  wednesday: 3, wed: 3, miyerkules: 3, miyerkoles: 3, thursday: 4, thu: 4, thur: 4, thurs: 4, huwebes: 4,
  friday: 5, fri: 5, biyernes: 5, saturday: 6, sat: 6, sabado: 6,
};
const MONTH: Record<string, number> = {
  january: 0, jan: 0, enero: 0, february: 1, feb: 1, pebrero: 1, march: 2, mar: 2, marso: 2, april: 3, apr: 3, abril: 3,
  june: 5, jun: 5, hunyo: 5, july: 6, jul: 6, hulyo: 6, august: 7, aug: 7, agosto: 7, september: 8, sep: 8, sept: 8,
  setyembre: 8, october: 9, oct: 9, oktubre: 9, november: 10, nov: 10, nobyembre: 10, december: 11, dec: 11, disyembre: 11,
  // "may" is only a month when a day number is next to it ("may 5", "5 may"): see dateMatch.
};
const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const TL_NUM: Record<string, number> = {
  una: 1, dos: 2, tres: 3, kwatro: 4, kuwatro: 4, singko: 5, sinko: 5, sais: 6, siyete: 7, syete: 7,
  otso: 8, nuwebe: 9, nueve: 9, diyes: 10, dyis: 10, onse: 11, dose: 12,
};

export const fmtDay = (d: Date) => d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });

/** Week runs Monday–Sunday unless weekStart says Sunday. */
function weekBounds(now: Date, weekStart: 0 | 1, offsetWeeks: number) {
  const today = startOfDay(now);
  const back = (today.getDay() - weekStart + 7) % 7;
  const first = addDays(today, -back + 7 * offsetWeeks);
  return { first, last: addDays(first, 6) };
}

/** Month/day → the next such date (a date more than ~2 months gone means next year). */
function nextDate(now: Date, month: number, day: number): Date | null {
  if (day < 1 || day > 31) return null;
  let d = new Date(now.getFullYear(), month, day);
  if (d.getMonth() !== month) return null;
  if (d.getTime() < addDays(startOfDay(now), -60).getTime()) d = new Date(now.getFullYear() + 1, month, day);
  return d;
}

function dateMatch(s: string, now: Date): Date | null {
  const months = Object.keys(MONTH).concat("may").join("|");
  const md = s.match(new RegExp(`\\b(${months})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`));
  if (md) return nextDate(now, md[1] === "may" ? 4 : MONTH[md[1]], +md[2]);
  const dm = s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${months})\\b`));
  if (dm) return nextDate(now, dm[2] === "may" ? 4 : MONTH[dm[2]], +dm[1]);
  const slash = s.match(/\b(\d{1,2})\/(\d{1,2})\b/); // PH and US both write month/day
  if (slash) return nextDate(now, +slash[1] - 1, +slash[2]);
  // "on the 25th", "sa 25", "this 25th": that day of this month, or next month once it's gone.
  const nth = s.match(/\b(?:on the|the|sa|this|on)\s+(\d{1,2})(?:st|nd|rd|th)?\b(?!\s*(?:am|pm|:))/);
  if (nth) {
    const day = +nth[1];
    let d = new Date(now.getFullYear(), now.getMonth(), day);
    if (d.getTime() < startOfDay(now).getTime()) d = new Date(now.getFullYear(), now.getMonth() + 1, day);
    return d.getDate() === day ? d : null;
  }
  return null;
}

export function parseDayRange(text: string, now: Date, weekStart: 0 | 1 = 1): DayRange {
  const s = fold(text).replace(/'/g, "");
  const today = startOfDay(now);
  const one = (d: Date, label: string): DayRange => ({ from: d, to: d, label, explicit: true });
  const has = (re: RegExp) => re.test(s);

  if (has(/\b(day after tomorrow|sa makalawa|makalawa)\b/)) return one(addDays(today, 2), DAY_NAMES[addDays(today, 2).getDay()]);
  if (has(/\b(tomorrow|tmrw|tmr|tom|tommorow|tomorow|tomorrows|bukas)\b/)) return one(addDays(today, 1), "tomorrow");
  if (has(/\b(yesterday|kahapon)\b/)) return one(addDays(today, -1), "yesterday");
  if (has(/\b(next week|susunod na linggo|sunod na linggo|next wk)\b/)) {
    const { first, last } = weekBounds(now, weekStart, 1);
    return { from: first, to: last, label: "next week", explicit: true };
  }
  if (has(/\b(this week|ngayong linggo|itong linggo|this wk|sa linggong ito|week)\b/)) {
    const { last } = weekBounds(now, weekStart, 0);
    return { from: today, to: last, label: "this week", explicit: true };
  }
  if (has(/\b(weekend|sabado at linggo)\b/)) {
    const sat = today.getDay() === 0 ? addDays(today, -1) : addDays(today, (6 - today.getDay() + 7) % 7);
    const from = today.getDay() === 0 ? today : sat;
    return { from, to: addDays(sat, 1), label: "this weekend", explicit: true };
  }
  const date = dateMatch(s, now);
  if (date) return one(date, date.getTime() === today.getTime() ? "today" : fmtDay(date));

  // Weekdays. "linggo" alone is Sunday only as "sa/on linggo" — otherwise it means "week".
  const days = Object.keys(WEEKDAY).join("|");
  const wd = s.match(new RegExp(`\\b(next\\s+|this\\s+|sa\\s+|on\\s+)?(${days})\\b`)) ?? s.match(/\b(sa|on)\s+(linggo)\b/);
  if (wd) {
    const target = wd[2] === "linggo" ? 0 : WEEKDAY[wd[2]];
    let ahead = (target - today.getDay() + 7) % 7;
    if (wd[1]?.trim() === "next" && ahead < 7) ahead += ahead === 0 ? 7 : 0;
    const d = addDays(today, ahead);
    return one(d, ahead === 0 ? "today" : DAY_NAMES[target]);
  }
  if (has(/\b(today|tonight|now|ngayon|ngayong araw|mamaya|later|this morning|this afternoon|this evening|kanina)\b/)) {
    return one(today, "today");
  }
  return { from: today, to: today, label: "today", explicit: false };
}

/** A time of day in the question, or null. Bare hours: 1–6 mean afternoon, 7–11 morning. */
export function parseTime(text: string): TimeOfDay | null {
  const s = fold(text);
  const hm = (h: number, m: number, ap?: string): TimeOfDay | null => {
    if (h > 23 || m > 59) return null;
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (!ap && h >= 1 && h <= 6) h += 12;
    return { h, m };
  };
  let m = s.match(/\b(\d{1,2}):(\d{2})\s*(am|pm)?\b/);
  if (m) return hm(+m[1], +m[2], m[3]);
  m = s.match(/\b(\d{1,2})\s*(am|pm)\b/);
  if (m) return hm(+m[1], 0, m[2]);
  if (/\b(noon|tanghali|lunch|tanghalian)\b/.test(s)) return { h: 12, m: 0 };
  m = s.match(/\balas\s+(\w+)(?:\s+y\s+media)?/);
  if (m) {
    const n = TL_NUM[m[1]] ?? (/^\d{1,2}$/.test(m[1]) ? +m[1] : NaN);
    if (!isNaN(n)) return hm(n, /y media/.test(m[0]) ? 30 : 0, /\bgabi\b/.test(s) && n < 12 ? "pm" : undefined);
  }
  m = s.match(/\b(?:at|ng|by|around|mga|mamayang)\s+(\d{1,2})\b(?!\s*(?:st|nd|rd|th|\/))/);
  if (m) return hm(+m[1], 0);
  return null;
}
