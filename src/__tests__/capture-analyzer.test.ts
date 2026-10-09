jest.mock("@/services/ai-complete", () => ({ completeText: jest.fn(async () => null) }));
import { analyzeHeuristic, parseDue, extractItems, parseAiAnalysis, analyzeCapture } from "@/services/capture-analyzer";
import { completeText } from "@/services/ai-complete";

// Thu, Oct 8 2026, 10:00 local
const NOW = new Date(2026, 9, 8, 10, 0);

const WORKSHEET = `Science 8 — Activity 3: Forces
Answer the following. Submit on or before October 15, 2026 11:59 PM.
1. What is Newton's first law?
2. Explain inertia with an example.
3) Compute the net force on a 5 kg box accelerating at 2 m/s².`;

describe("parseDue", () => {
  it("prefers the date right after a due/submit cue, with its time", () => {
    const d = parseDue(WORKSHEET, NOW)!;
    expect(d.hasTime).toBe(true);
    expect(d.date.getFullYear()).toBe(2026);
    expect(d.date.getMonth()).toBe(9);
    expect(d.date.getDate()).toBe(15);
    expect(d.date.getHours()).toBe(23);
    expect(d.date.getMinutes()).toBe(59);
  });

  it("handles day-month, m/d, weekdays and tomorrow", () => {
    expect(parseDue("Deadline: 20 Oct", NOW)!.date.getDate()).toBe(20);
    expect(parseDue("due 10/22", NOW)!.date.getDate()).toBe(22);
    const fri = parseDue("Pass this on Friday 3pm", NOW)!;
    expect(fri.date.getDay()).toBe(5);
    expect(fri.date.getDate()).toBe(9);
    expect(fri.date.getHours()).toBe(15);
    expect(parseDue("submit tomorrow", NOW)!.date.getDate()).toBe(9);
  });

  it("defaults to end of day when no time and rolls a long-past date to next year", () => {
    const d = parseDue("Quiz on Jan 5", NOW)!;
    expect(d.hasTime).toBe(false);
    expect(d.date.getFullYear()).toBe(2027);
    expect(d.date.getHours()).toBe(23);
  });

  it("returns null when there is no date", () => {
    expect(parseDue("Read chapter 4 carefully", NOW)).toBeNull();
  });
});

describe("extractItems", () => {
  it("pulls numbered questions and task-verb lines, deduped", () => {
    const items = extractItems(WORKSHEET + "\n1. What is Newton's first law?");
    expect(items).toEqual([
      "What is Newton's first law?",
      "Explain inertia with an example.",
      "Compute the net force on a 5 kg box accelerating at 2 m/s².",
    ]);
  });
});

describe("analyzeHeuristic", () => {
  it("recognises an assignment with subject, due date and items", () => {
    const a = analyzeHeuristic(WORKSHEET, NOW);
    expect(a.kind).toBe("assignment");
    expect(a.subject).toBe("Science");
    expect(a.items).toHaveLength(3);
    expect(a.due).toBeDefined();
    expect(a.confidence).toBeGreaterThan(0.5);
  });

  it("recognises an exam notice", () => {
    expect(analyzeHeuristic("MIDTERM EXAM\nCoverage: Chapters 1-5\nExam date: Oct 20", NOW).kind).toBe("exam");
  });

  it("is unsure about unrelated text so the UI asks the user", () => {
    const a = analyzeHeuristic("Mango Shake 85\nIced Coffee 120", NOW);
    expect(a.kind).toBe("other");
    expect(a.confidence).toBeLessThan(0.5);
  });
});

describe("AI output", () => {
  it("parses JSON wrapped in prose and rejects garbage", () => {
    const parsed = parseAiAnalysis('Sure! {"kind":"exam","title":"Bio quiz","subject":"Biology","due":"2026-10-12T08:00","dueHasTime":true,"items":["Cells"],"summary":"Quiz"}');
    expect(parsed?.kind).toBe("exam");
    expect(parsed?.dueHasTime).toBe(true);
    expect(parseAiAnalysis("no json here")).toBeNull();
    expect(parseAiAnalysis('{"kind":"banana"}')).toBeNull();
  });

  it("falls back to the offline reading when no model is available", async () => {
    const a = await analyzeCapture(WORKSHEET, NOW);
    expect(a.source).toBe("heuristic");
    expect(a.kind).toBe("assignment");
  });

  it("keeps the heuristic due date when the model omits it", async () => {
    (completeText as jest.Mock).mockResolvedValueOnce('{"kind":"assignment","title":"Forces activity","due":null,"items":[]}');
    const a = await analyzeCapture(WORKSHEET, NOW);
    expect(a.source).toBe("ai");
    expect(a.title).toBe("Forces activity");
    expect(a.due).toBeDefined();
    expect(a.items).toHaveLength(3);
  });
});
