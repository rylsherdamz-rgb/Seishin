import {
  monthMatrix, weekOf, parseQuickAdd, addDays, recurrenceToState, buildRecurrence, sortItems,
  type CalendarItem,
} from "@/components/calendar/calendar-utils";
import { layoutEvents } from "@/components/calendar/timeline-layout";
import { THEMES, ACCENTS, buildPalette, hexToChannels, paletteToVars } from "@/theme/themes";
import { dateKey } from "@/utils/recurrence";

const ev = (id: string, start: string, end: string): CalendarItem => ({
  id, type: "event", title: id, date: "2026-10-07",
  startDate: `2026-10-07T${start}:00`, endDate: `2026-10-07T${end}:00`,
});

describe("month/week helpers", () => {
  it("builds a 6x7 Sunday-first grid that covers the month", () => {
    const m = monthMatrix("2026-10-15");
    expect(m).toHaveLength(6);
    expect(m.every((w) => w.length === 7)).toBe(true);
    expect(m[0][0]).toBe("2026-09-27"); // Oct 1 2026 is a Thursday
    expect(m.flat()).toContain("2026-10-31");
  });

  it("returns the Sunday-start week containing a date", () => {
    expect(weekOf("2026-10-07")).toEqual([
      "2026-10-04", "2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-10",
    ]);
  });
});

describe("parseQuickAdd", () => {
  const base = "2026-10-07";
  it("extracts time, duration and title", () => {
    const p = parseQuickAdd("Lunch with Sam 1pm for 90m", base);
    expect(p).toEqual({ title: "Lunch with Sam", date: base, minutes: 13 * 60, duration: 90 });
  });

  it("understands 24h times and hours", () => {
    const p = parseQuickAdd("Deep work 14:30 2h", base);
    expect(p.minutes).toBe(14 * 60 + 30);
    expect(p.duration).toBe(120);
    expect(p.title).toBe("Deep work");
  });

  it("resolves tomorrow relative to the real today", () => {
    const p = parseQuickAdd("Gym tomorrow 6pm", base);
    expect(p.date).toBe(addDays(dateKey(new Date()), 1));
    expect(p.minutes).toBe(18 * 60);
    expect(p.title).toBe("Gym");
  });

  it("handles 12am/12pm and plain titles", () => {
    expect(parseQuickAdd("x 12am", base).minutes).toBe(0);
    expect(parseQuickAdd("x 12pm", base).minutes).toBe(12 * 60);
    expect(parseQuickAdd("Call mom", base)).toEqual({ title: "Call mom", date: base, minutes: null, duration: null });
  });
});

describe("recurrence round-trip", () => {
  it("maps weekday presets back to their mode", () => {
    expect(recurrenceToState(buildRecurrence("weekdays", []))).toEqual({ mode: "weekdays", weekdays: [] });
    expect(recurrenceToState(buildRecurrence("custom", [5, 1]))).toEqual({ mode: "custom", weekdays: [1, 5] });
    expect(recurrenceToState(undefined).mode).toBe("none");
  });
});

describe("timeline layout", () => {
  it("puts overlapping events side by side and keeps others full width", () => {
    const placed = layoutEvents([ev("a", "09:00", "10:00"), ev("b", "09:30", "11:00"), ev("c", "12:00", "13:00")]);
    const byId = Object.fromEntries(placed.map((p) => [p.item.id, p]));
    expect(byId.a.cols).toBe(2);
    expect(byId.b.cols).toBe(2);
    expect(byId.a.col).not.toBe(byId.b.col);
    expect(byId.c.cols).toBe(1);
  });

  it("reuses a freed column inside a cluster", () => {
    const placed = layoutEvents([ev("a", "09:00", "12:00"), ev("b", "09:00", "10:00"), ev("c", "10:00", "11:00")]);
    const byId = Object.fromEntries(placed.map((p) => [p.item.id, p]));
    expect(byId.a.cols).toBe(2);
    expect(byId.c.col).toBe(byId.b.col);
  });

  it("sorts timed events chronologically after all-day/todos", () => {
    const todo: CalendarItem = { id: "t", type: "todo", title: "t", date: "2026-10-07" };
    const sorted = sortItems([ev("late", "15:00", "16:00"), ev("early", "08:00", "09:00"), todo]);
    expect(sorted.map((i) => i.id)).toEqual(["t", "early", "late"]);
  });
});

describe("themes", () => {
  it("converts hex to css channel triplets", () => {
    expect(hexToChannels("#ff3b30")).toBe("255 59 48");
    expect(hexToChannels("#fff")).toBe("255 255 255");
  });

  it("mono accent follows the ink and inverts on dark themes", () => {
    const light = buildPalette(THEMES.light, ACCENTS.mono);
    const dark = buildPalette(THEMES.dark, ACCENTS.mono);
    expect(light.accent).toBe(THEMES.light.ink.black);
    expect(dark.accent).toBe(THEMES.dark.ink.black);
    expect(dark.onAccent).toBe(THEMES.dark.ink.white);
  });

  it("emits a css variable for every token", () => {
    const vars = paletteToVars(buildPalette(THEMES.midnight, ACCENTS.blue));
    expect(vars["--c-accent"]).toBe(hexToChannels(ACCENTS.blue.dark!));
    expect(Object.values(vars).every((v) => /^\d+ \d+ \d+$/.test(v))).toBe(true);
  });
});
