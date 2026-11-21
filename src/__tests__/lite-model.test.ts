/**
 * The shipped Seishin Lite model (src/services/lite/model.json) in TypeScript must
 * match what train.py measured in Python, and must pass the hand-written exam.
 */
import model from "@/services/lite/model.json";
import { classify, predict, decodeInt8, FAMILY, LABELS, SOLO_THRESHOLD, THRESHOLD } from "@/services/lite/model";
import { featureKeys, normalize, isCommand, fnv1a } from "@/services/lite/features";

test("probabilities match the Python trainer (parity vectors)", () => {
  for (const { text, probs } of model.parity) {
    const p = predict(text);
    p.forEach((v, i) => expect(v).toBeCloseTo(probs[i], 3));
  }
});

test.each([
  ["with a model (strict)", THRESHOLD, true, 0.5],
  ["no model (best guess)", SOLO_THRESHOLD, false, 0.65],
])("hand-written probe, %s: never the wrong kind of answer", (_, bar, guard, minAnswered) => {
  let answered = 0, wrongFamily = 0, actionsAnswered = 0;
  for (const [text, want] of model.probe as [string, string][]) {
    const c = classify(text);
    const got = c.intent !== "other" && (!guard || c.aboutMe) && c.confidence >= (bar as number) ? c.intent : null;
    if (!got) continue;
    answered++;
    if (FAMILY[got] !== FAMILY[want as keyof typeof FAMILY]) wrongFamily++;
    if (want === "other") actionsAnswered++;
  }
  expect(answered / model.probe.length).toBeGreaterThan(minAnswered as number);
  expect(wrongFamily).toBe(0);
  expect(actionsAnswered).toBe(0);
});

test("off-topic questions with date words are not about the user", () => {
  for (const t of ["what does the weather look like this week", "what's happening in ny"]) {
    expect(classify(t).aboutMe).toBe(false);
  }
  for (const t of ["what's next", "ano ganap ko bukas", "am i free at 3"]) expect(classify(t).aboutMe).toBe(true);
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
  expect(model.confidence).toBe("family");
  expect(SOLO_THRESHOLD).toBeLessThan(THRESHOLD);
});
