import { occursOnDate, expandOccurrences, recurrenceLabel, dateKey } from "../utils/recurrence";
import type { CalendarEvent } from "../stores/calendar-store";

function ev(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    title: "Test",
    startDate: "2026-01-05T09:00:00.000Z",
    endDate: "2026-01-05T10:00:00.000Z",
    source: "manual",
    ...overrides,
  };
}

describe("occursOnDate", () => {
  it("matches non-recurring events only on their start date", () => {
    const e = ev();
    expect(occursOnDate(e, "2026-01-05")).toBe(true);
    expect(occursOnDate(e, "2026-01-06")).toBe(false);
  });

  it("expands daily events", () => {
    const e = ev({ recurrence: { frequency: "daily", interval: 1 } });
    expect(occursOnDate(e, "2026-01-05")).toBe(true);
    expect(occursOnDate(e, "2026-01-10")).toBe(true);
    expect(occursOnDate(e, "2025-12-31")).toBe(false);
  });

  it("expands Mon-Fri weekday events", () => {
    const e = ev({ recurrence: { frequency: "weekly", interval: 1, weekdays: [1, 2, 3, 4, 5] } });
    // 2026-01-05 is a Monday
    expect(occursOnDate(e, "2026-01-05")).toBe(true);
    expect(occursOnDate(e, "2026-01-06")).toBe(true);
    // 2026-01-10 is a Saturday
    expect(occursOnDate(e, "2026-01-10")).toBe(false);
    expect(occursOnDate(e, "2026-01-11")).toBe(false);
  });

  it("expands Mon-Sun (every day of the week) events", () => {
    const e = ev({ recurrence: { frequency: "weekly", interval: 1, weekdays: [0, 1, 2, 3, 4, 5, 6] } });
    expect(occursOnDate(e, "2026-01-05")).toBe(true);
    expect(occursOnDate(e, "2026-01-10")).toBe(true);
    expect(occursOnDate(e, "2026-01-11")).toBe(true);
  });

  it("expands weekly events on the start weekday", () => {
    const e = ev({ recurrence: { frequency: "weekly", interval: 1 } });
    expect(occursOnDate(e, "2026-01-05")).toBe(true);
    expect(occursOnDate(e, "2026-01-12")).toBe(true);
    expect(occursOnDate(e, "2026-01-06")).toBe(false);
  });

  it("expands monthly events on the start day of month", () => {
    const e = ev({ recurrence: { frequency: "monthly", interval: 1 } });
    expect(occursOnDate(e, "2026-02-05")).toBe(true);
    expect(occursOnDate(e, "2026-03-05")).toBe(true);
    expect(occursOnDate(e, "2026-03-06")).toBe(false);
  });

  it("respects an until end date", () => {
    const e = ev({ recurrence: { frequency: "daily", interval: 1, until: "2026-01-10" } });
    expect(occursOnDate(e, "2026-01-10")).toBe(true);
    expect(occursOnDate(e, "2026-01-11")).toBe(false);
  });
});

describe("expandOccurrences", () => {
  it("returns occurrences within a window", () => {
    const e = ev({ recurrence: { frequency: "weekly", interval: 1, weekdays: [1, 2, 3, 4, 5] } });
    const dates = expandOccurrences(e, "2026-01-06", "2026-01-09");
    expect(dates).toEqual(["2026-01-06", "2026-01-07", "2026-01-08", "2026-01-09"]);
  });

  it("returns nothing for a non-recurring event outside the window", () => {
    expect(expandOccurrences(ev(), "2026-02-01", "2026-02-28")).toEqual([]);
    expect(expandOccurrences(ev(), "2026-01-01", "2026-01-31")).toEqual(["2026-01-05"]);
  });

  it("caps at maxCount", () => {
    const e = ev({ recurrence: { frequency: "daily", interval: 1 } });
    const dates = expandOccurrences(e, "2026-01-05", "2030-01-01", 10);
    expect(dates.length).toBe(10);
  });
});

describe("recurrenceLabel", () => {
  it("labels weekday schedules", () => {
    expect(recurrenceLabel({ frequency: "weekly", interval: 1, weekdays: [1, 2, 3, 4, 5] })).toBe("Weekdays (Mon–Fri)");
  });
  it("labels every-day schedules", () => {
    expect(recurrenceLabel({ frequency: "weekly", interval: 1, weekdays: [0, 1, 2, 3, 4, 5, 6] })).toBe("Every day");
  });
  it("labels weekly and monthly", () => {
    expect(recurrenceLabel({ frequency: "weekly", interval: 1 })).toBe("Every week");
    expect(recurrenceLabel({ frequency: "monthly", interval: 1 })).toBe("Every month");
  });
  it("labels custom weekday sets", () => {
    expect(recurrenceLabel({ frequency: "weekly", interval: 1, weekdays: [0, 2] })).toBe("Every Sun, Tue");
  });
});

describe("dateKey", () => {
  it("formats local dates as YYYY-MM-DD", () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
