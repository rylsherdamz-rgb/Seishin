import { planEventAlarms, catchUpSlot, isPendingLate, parseRecord } from "@/services/event-alarm-plan";
import type { CalendarEvent } from "@/stores/calendar-store";

const at = (y: number, mo: number, d: number, h = 0, mi = 0) => new Date(y, mo - 1, d, h, mi);
const ev = (o: Partial<CalendarEvent>): CalendarEvent => ({
  id: "e1", title: "Class", startDate: at(2026, 10, 15, 9).toISOString(), endDate: at(2026, 10, 15, 10).toISOString(), source: "manual", reminder: 15, ...o,
});
const NOW = at(2026, 10, 14, 12);

describe("planEventAlarms", () => {
  it("schedules upcoming reminders soonest first and skips ones already past", () => {
    const plan = planEventAlarms([
      ev({ id: "later", startDate: at(2026, 10, 16, 9).toISOString(), endDate: at(2026, 10, 16, 10).toISOString() }),
      ev({ id: "soon" }),
      ev({ id: "past", startDate: at(2026, 10, 14, 8).toISOString(), endDate: at(2026, 10, 14, 9).toISOString() }),
      ev({ id: "noreminder", reminder: undefined }),
    ], NOW);
    expect(plan.map((s) => s.eventId)).toEqual(["soon", "later"]);
    expect(plan[0].fireAt).toEqual(at(2026, 10, 15, 8, 45));
  });

  it("imported events get a normal reminder, own events an alarm", () => {
    const [g, mine] = planEventAlarms([ev({ id: "g", source: "calendar" }), ev({ id: "m", startDate: at(2026, 10, 15, 11).toISOString() })], NOW);
    expect(g.kind).toBe("reminder");
    expect(mine.kind).toBe("alarm");
  });

  it("all-day events ring in the morning, not at midnight", () => {
    const [s] = planEventAlarms([ev({ allDay: true, startDate: at(2026, 10, 15).toISOString(), endDate: at(2026, 10, 15, 23, 59).toISOString(), reminder: 10 })], NOW);
    expect(s.fireAt).toEqual(at(2026, 10, 15, 8));
  });

  it("expands recurring events within the horizon and caps the total", () => {
    const daily = ev({ recurrence: { frequency: "daily", interval: 1 } });
    expect(planEventAlarms([daily], NOW, { horizonDays: 7 })).toHaveLength(7);
    expect(planEventAlarms([daily], NOW, { horizonDays: 30, max: 5 })).toHaveLength(5);
  });

  it("signature changes when the time or title changes", () => {
    const [a] = planEventAlarms([ev({})], NOW);
    const [b] = planEventAlarms([ev({ title: "Moved" })], NOW);
    expect(a.key).toBe(b.key);
    expect(a.sig).not.toBe(b.sig);
  });
});

describe("catch-up ring", () => {
  it("rings shortly for a just-added event whose reminder moment passed, never for old ones", () => {
    const now = at(2026, 10, 15, 8, 50);
    const late = catchUpSlot(ev({}), now)!;
    expect(late.fireAt.getTime() - now.getTime()).toBe(10000);
    expect(isPendingLate(late.sig, now)).toBe(true);
    expect(catchUpSlot(ev({}), at(2026, 10, 16, 9))).toBeNull();
    expect(catchUpSlot(ev({}), at(2026, 10, 14, 9))).toBeNull(); // not due yet → normal plan
    expect(catchUpSlot(ev({}), at(2026, 10, 15, 9, 2))).toBeNull(); // already started
  });

  it("reads old and new map records", () => {
    expect(parseRecord("abc")).toEqual({ id: "abc", sig: "" });
    expect(parseRecord("abc|x|1")).toEqual({ id: "abc", sig: "x|1" });
  });
});
