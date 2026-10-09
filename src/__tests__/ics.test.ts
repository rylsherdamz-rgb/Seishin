jest.mock("@/services/notification-service", () => ({ scheduleEventReminder: jest.fn(async () => {}), cancelEventReminder: jest.fn() }));
import { parseIcs, parseIcsDate, parseDuration, parseRrule, looksLikeDeadline } from "@/services/connectors/ics";

const FEED = [
  "BEGIN:VCALENDAR",
  "VERSION:2.0",
  "BEGIN:VEVENT",
  "UID:assignment-123@canvas",
  "DTSTART:20261015T155900Z",
  "DTEND:20261015T155900Z",
  "SUMMARY:Lab Report 3 [BIO 101]",
  "DESCRIPTION:Submit the lab report\\, include graphs.\\nDue at 11:59 PM",
  "URL:https://school.instructure.com/courses/1/assignments/123",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:allday-1",
  "DTSTART;VALUE=DATE:20261020",
  "DTEND;VALUE=DATE:20261021",
  "SUMMARY:Foundation Day — no cla",
  " sses",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:weekly-1",
  "DTSTART;TZID=Asia/Manila:20261012T090000",
  "DURATION:PT1H30M",
  "RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261218T000000Z",
  "SUMMARY:Calculus lecture",
  "LOCATION:Room 204\; Main Bldg",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:cancelled-1",
  "DTSTART:20261016T010000Z",
  "STATUS:CANCELLED",
  "SUMMARY:Cancelled thing",
  "END:VEVENT",
  "BEGIN:VEVENT",
  "UID:weekly-1",
  "RECURRENCE-ID;TZID=Asia/Manila:20261014T090000",
  "DTSTART;TZID=Asia/Manila:20261014T100000",
  "SUMMARY:Calculus lecture (moved)",
  "END:VEVENT",
  "END:VCALENDAR",
].join("\r\n");

describe("parseIcs", () => {
  const events = parseIcs(FEED);

  it("skips cancelled events and modified single occurrences", () => {
    expect(events.map((e) => e.uid)).toEqual(["assignment-123@canvas", "allday-1", "weekly-1"]);
  });

  it("reads UTC times, unescapes text and keeps the URL", () => {
    const a = events[0];
    expect(a.start.toISOString()).toBe("2026-10-15T15:59:00.000Z");
    expect(a.description).toBe("Submit the lab report, include graphs.\nDue at 11:59 PM");
    expect(a.url).toContain("assignments/123");
    // Zero-length deadline entries get a sensible end.
    expect(a.end.getTime()).toBeGreaterThan(a.start.getTime());
  });

  it("unfolds lines and handles all-day events with exclusive DTEND", () => {
    const d = events[1];
    expect(d.title).toBe("Foundation Day — no classes");
    expect(d.allDay).toBe(true);
    expect(d.end.getDate()).toBe(20);
  });

  it("converts TZID wall time to the right instant and maps the RRULE", () => {
    const w = events[2];
    expect(w.start.toISOString()).toBe("2026-10-12T01:00:00.000Z"); // 09:00 Manila = 01:00 UTC
    expect(w.end.getTime() - w.start.getTime()).toBe(90 * 60000);
    expect(w.location).toBe("Room 204; Main Bldg");
    expect(w.recurrence).toEqual({ frequency: "weekly", interval: 1, weekdays: [1, 3], until: "2026-12-18" });
  });
});

describe("helpers", () => {
  it("parses dates, durations and unsupported rules safely", () => {
    expect(parseIcsDate("bogus", {})).toBeNull();
    expect(parseDuration("P1W")).toBe(7 * 86400000);
    expect(parseDuration("PT45M")).toBe(45 * 60000);
    expect(parseRrule("FREQ=YEARLY")).toBeUndefined();
    expect(parseRrule("FREQ=DAILY;COUNT=5")).toBeUndefined();
    expect(parseRrule("FREQ=MONTHLY;INTERVAL=2")).toEqual({ frequency: "monthly", interval: 2 });
  });

  it("spots deadline-like entries", () => {
    const events = parseIcs(FEED);
    expect(looksLikeDeadline(events[0])).toBe(true);
    expect(looksLikeDeadline(events[2])).toBe(false);
  });
});

describe("planFeed", () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { planFeed, normalizeFeedUrl } = require("@/services/connectors/feeds");
  const NOW = new Date("2026-10-08T00:00:00Z");

  it("auto mode: deadline entries → tasks, others → read-only feed events", () => {
    const { events, tasks } = planFeed({ id: "canvas", mode: "auto" }, parseIcs(FEED), NOW);
    expect(tasks.map((t: { title: string }) => t.title)).toEqual(["Lab Report 3 [BIO 101]"]);
    expect(events.map((e: { title: string }) => e.title)).toEqual(["Foundation Day — no classes", "Calculus lecture"]);
    expect(events.every((e: { source: string; externalCalendarId: string }) => e.source === "feed" && e.externalCalendarId === "feed:canvas")).toBe(true);
  });

  it("events mode keeps everything as events; ids are stable across refreshes", () => {
    const a = planFeed({ id: "x", mode: "events" }, parseIcs(FEED), NOW);
    const b = planFeed({ id: "x", mode: "events" }, parseIcs(FEED), NOW);
    expect(a.tasks).toEqual([]);
    expect(a.events.map((e: { id: string }) => e.id)).toEqual(b.events.map((e: { id: string }) => e.id));
  });

  it("drops one-off entries older than 30 days", () => {
    const later = new Date("2027-01-01T00:00:00Z");
    expect(planFeed({ id: "x", mode: "events" }, parseIcs(FEED), later).events.map((e: { title: string }) => e.title)).toEqual(["Calculus lecture"]);
  });

  it("accepts webcal links and rejects non-https", () => {
    expect(normalizeFeedUrl("webcal://school.edu/feed.ics")).toBe("https://school.edu/feed.ics");
    expect(normalizeFeedUrl("http://insecure.example/feed.ics")).toBeNull();
  });
});
