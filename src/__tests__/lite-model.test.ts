/**
 * The shipped Seishin Lite model (src/services/lite/model.json) in TypeScript must
 * match what train.py measured in Python, and must pass the hand-written exam.
 */
import model from "@/services/lite/model.json";
import { classify, predict, decodeInt8, LABELS, THRESHOLD } from "@/services/lite/model";
import { featureKeys, normalize, isCommand, fnv1a } from "@/services/lite/features";

test("probabilities match the Python trainer (parity vectors)", () => {
  for (const { text, probs } of model.parity) {
    const p = predict(text);
    p.forEach((v, i) => expect(v).toBeCloseTo(probs[i], 3));
  }
});

test("hand-written probe: safe routing", () => {
  const FAMILY: Record<string, string> = {
    agenda: "sched", next_event: "sched", free_time: "sched", find_event: "sched",
    tasks_due: "tasks", overdue: "tasks", greeting: "chat", thanks: "chat", help: "chat", other: "other",
  };
  let answered = 0, wrongFamily = 0, actionsAnswered = 0;
  for (const [text, want] of model.probe as [string, string][]) {
    const c = classify(text);
    const got = c.intent !== "other" && c.confidence >= THRESHOLD ? c.intent : null;
    if (!got) continue;
    answered++;
    if (FAMILY[got] !== FAMILY[want]) wrongFamily++;
    if (want === "other") actionsAnswered++;
  }
  const n = model.probe.length;
  expect(answered / n).toBeGreaterThan(0.65);
  expect(wrongFamily).toBeLessThanOrEqual(1);
  expect(actionsAnswered).toBeLessThanOrEqual(1);
});

test("features: placeholders, cue groups and the command guard", () => {
  expect(normalize("What's on Friday at 3:30pm, Nov 25?")).toEqual(["whats", "on", "qday", "at", "qtime", "qmonth", "qnum"]);
  expect(normalize("may meeting ba ako")).toContain("may");
  expect(featureKeys(["free", "ba", "ako"])).toEqual(expect.arrayContaining(["k:free", "s:free", "f:free", "c:#fr"]));
  expect(fnv1a("w:hi")).toBe(fnv1a("w:hi") >>> 0);
  for (const t of ["add a meeting tomorrow", "Remind me to call mom", "ilipat mo yung exam", "Set an alarm"]) expect(isCommand(t)).toBe(true);
  for (const t of ["remind me what's on tomorrow", "schedule for next week", "what's lined up today"]) expect(isCommand(t)).toBe(false);
});

test("int8 decoding", () => {
  expect(Array.from(decodeInt8("AH+Bgf8="))).toEqual([0, 127, -127, -127, -1]);
  expect(LABELS).toContain("other");
});
