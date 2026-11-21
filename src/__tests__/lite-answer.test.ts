/**
 * Seishin Lite end to end: question → trained intent → answer from real data.
 * "Now" is Wednesday 25 Nov 2026, 10:00 local.
 */
import { askLite } from "@/services/lite";
import { parseDayRange, parseTime } from "@/services/lite/when";
import type { LiteData } from "@/services/lite/answer";
import type { CalendarEvent } from "@/stores/calendar-store";
import type { Todo } from "@/stores/todo-store";

jest.mock("@/stores/calendar-store", () => ({ useCalendarStore: { getState: () => ({ events: [] }) } }));
jest.mock("@/stores/todo-store", () => ({ useTodoStore: { getState: () => ({ todos: [] }) } }));
jest.mock("@/stores/theme-store", () => ({ useThemeStore: { getState: () => ({ timeFormat: "12h", weekStart: 1 }) } }));

const NOW = new Date(2026, 10, 25, 10, 0); // Wed
const at = (d: number, h: number, m = 0) => new Date(2026, 10, d, h, m).toISOString();
const ev = (id: string, title: string, start: string, end: string, extra: Partial<CalendarEvent> = {}): CalendarEvent =>
  ({ id, title, startDate: start, endDate: end, source: "manual", ...extra });
const todo = (id: string, title: string, due?: string, extra: Partial<Todo> = {}): Todo =>
  ({ id, title, dueDate: due, completed: false, priority: "medium", category: "", tags: [], createdAt: at(1, 9), ...extra });

const data: LiteData = {
  now: NOW,
  timeFormat: "12h",
  weekStart: 1,
  events: [
    ev("1", "Standup", at(25, 9), at(25, 9, 15), { recurrence: { frequency: "daily", interval: 1 } }),
    ev("2", "Physics lab", at(25, 14), at(25, 16)),
    ev("3", "Dentist", at(27, 10, 30), at(27, 11, 30)),
    ev("4", "Thesis defense", at(30, 13), at(30, 15)),
    ev("5", "Org fair", new Date(2026, 10, 28).toISOString(), new Date(2026, 10, 29).toISOString(), { allDay: true }),
  ],
  todos: [
    todo("a", "Submit essay", new Date(2026, 10, 25, 23, 59).toISOString(), { priority: "high" }),
    todo("b", "Problem set 4", at(27, 17)),
    todo("c", "Pay rent", new Date(2026, 10, 23, 23, 59).toISOString()),
    todo("d", "Read chapter 3"),
    todo("e", "Old done thing", at(20, 9), { completed: true }),
  ],
};

const ask = (q: string, hasModel = true) => askLite(q, hasModel, data);

test("what's lined up today: events in order, what's due, overdue nudge", () => {
  const r = ask("what's lined up today?")!;
  expect(r.intent).toBe("agenda");
  expect(r.text).toContain("**Today · Wed, Nov 25**");
  expect(r.text.indexOf("Standup")).toBeLessThan(r.text.indexOf("Physics lab"));
  expect(r.text).toContain("**2:00 PM–4:00 PM** · Physics lab");
  expect(r.text).toContain("Submit essay · high priority");
  expect(r.text).toContain("1 task overdue");
});

test("Tagalog: may lakad ba ako sa biyernes → Friday", () => {
  const r = ask("ano ganap ko sa biyernes")!;
  expect(r.intent).toBe("agenda");
  expect(r.text).toContain("Friday · Fri, Nov 27");
  expect(r.text).toContain("Dentist");
  expect(r.text).toContain("Problem set 4");
});

test("this weekend lists the all-day event and repeats daily standup", () => {
  const r = ask("whats happening this weekend")!;
  expect(r.text).toContain("Org fair");
  expect(r.text).toContain("**Sat, Nov 28**");
  expect((r.text.match(/Standup/g) ?? []).length).toBe(2);
});

test("free at a time: busy vs free", () => {
  expect(ask("am i free at 3pm")!.text).toMatch(/^No — at 3:00 PM today you have \*\*Physics lab\*\*/);
  expect(ask("free ba ako ng alas onse")!.text).toMatch(/^Yes, you're free at 11:00 AM today until 2:00 PM \(Physics lab\)/);
});

test("when am i free lists the gaps after now", () => {
  const t = ask("when am i free today")!.text;
  expect(t).toContain("**Free today**");
  expect(t).toContain("- 10:00 AM–2:00 PM");
  expect(t).toContain("- 4:00 PM–10:00 PM");
});

test("what's next names the next event and how far away", () => {
  const t = ask("what's next")!.text;
  expect(t).toContain("**Next up:** Physics lab — 2:00 PM (in 4 h)");
});

test("what's due: next 7 days, overdue listed, undated counted", () => {
  const t = ask("what's due")!.text;
  expect(t).toContain("**Due in the next 7 days**");
  expect(t).toContain("Problem set 4");
  expect(t).toContain("**Overdue**");
  expect(t).toContain("Pay rent");
  expect(t).toContain("Plus 1 task with no due date.");
  expect(t).not.toContain("Old done thing");
});

test("overdue and find_event", () => {
  expect(ask("what did i miss")!.text).toContain("Pay rent");
  expect(ask("when is my dentist appointment")!.text).toMatch(/^\*\*Dentist\*\* — Fri, Nov 27, 10:30 AM/);
  expect(ask("kailan ang thesis defense")!.text).toContain("Mon, Nov 30, 1:00 PM");
});

test("hands to the language model: actions, general questions, unmatched searches", () => {
  expect(ask("remind me to call mom tomorrow")).toBeNull();
  expect(ask("add a meeting friday at 3")).toBeNull();
  expect(ask("explain recursion")).toBeNull();
  expect(ask("when is my karate tournament")).toBeNull(); // no such event: the LLM may know more
});

test("greeting summarises the day; help lists what it can answer", () => {
  expect(ask("good morning")!.text).toMatch(/^Good morning! You have 2 events and 1 task due today/);
  expect(ask("what can you do?")!.text).toContain("What's lined up today");
});

describe("when.ts", () => {
  const label = (q: string) => parseDayRange(q, NOW, 1).label;
  test.each([
    ["bukas", "tomorrow"], ["sa makalawa", "Friday"], ["on monday", "Monday"], ["sa linggo", "Sunday"],
    ["ngayong linggo", "this week"], ["next week", "next week"], ["on nov 30", "Mon, Nov 30"], ["sa 28", "Sat, Nov 28"],
    ["what's up", "today"],
  ])("%s → %s", (q, want) => expect(label(q)).toBe(want));
  test("this week runs to Sunday; next week is Mon–Sun", () => {
    const tw = parseDayRange("this week", NOW, 1);
    expect(tw.to.getDate()).toBe(29);
    const nw = parseDayRange("next week", NOW, 1);
    expect([nw.from.getDate(), nw.to.getDate()]).toEqual([30, 6]);
  });
  test.each([
    ["at 3", { h: 15, m: 0 }], ["3:30pm", { h: 15, m: 30 }], ["10am", { h: 10, m: 0 }], ["alas tres", { h: 15, m: 0 }],
    ["noon", { h: 12, m: 0 }], ["mamayang 5", { h: 17, m: 0 }], ["what's up", null],
  ])("time %s", (q, want) => expect(parseTime(q)).toEqual(want));
});
