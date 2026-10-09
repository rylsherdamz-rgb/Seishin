import { planReminders, dueLabel } from "@/services/reminder-plan";

const NOW = new Date(2026, 9, 8, 10, 0); // Thu Oct 8, 10:00
const DUE = new Date(2026, 9, 12, 23, 59); // Mon Oct 12, 23:59

describe("planReminders", () => {
  it("persistent: twice daily, countdown, due-day nudges and overdue follow-ups", () => {
    const plan = planReminders(DUE, NOW, "persistent");
    const at = plan.map((p) => p.at.getTime());
    expect(at).toEqual([...at].sort((a, b) => a - b));
    expect(plan.every((p) => p.at > NOW)).toBe(true);
    // Countdown + exact deadline present
    expect(at).toContain(DUE.getTime());
    expect(at).toContain(DUE.getTime() - 2 * 3600000);
    // Evening today and each day before the deadline
    expect(plan.some((p) => p.at.getDate() === 8 && p.at.getHours() === 19)).toBe(true);
    expect(plan.some((p) => p.at.getDate() === 10 && p.at.getHours() === 9)).toBe(true);
    // Overdue nudge the morning after
    expect(plan.some((p) => p.at.getDate() === 13 && p.at.getHours() === 9)).toBe(true);
    expect(plan.length).toBeLessThanOrEqual(40);
  });

  it("respects quiet hours except the final countdown", () => {
    const plan = planReminders(DUE, NOW, "persistent");
    const quiet = plan.filter((p) => p.at.getHours() >= 22 || p.at.getHours() < 7);
    for (const q of quiet) expect(DUE.getTime() - q.at.getTime()).toBeLessThanOrEqual(2 * 3600000);
  });

  it("normal: only the countdown; a day-before reminder in quiet hours moves to 9 PM", () => {
    const plan = planReminders(DUE, NOW, "normal");
    expect(plan[0].at).toEqual(new Date(2026, 9, 11, 21, 0));
    expect(plan.slice(1).map((p) => DUE.getTime() - p.at.getTime())).toEqual([6 * 3600000, 2 * 3600000, 30 * 60000, 0]);
  });

  it("off and no-due handling", () => {
    expect(planReminders(DUE, NOW, "off")).toEqual([]);
    const daily = planReminders(null, NOW, "persistent");
    expect(daily.length).toBeGreaterThanOrEqual(14);
    expect(daily.every((p) => p.at.getHours() === 9)).toBe(true);
  });
});

describe("dueLabel", () => {
  it("reads naturally", () => {
    expect(dueLabel(DUE, new Date(2026, 9, 12, 21, 59))).toMatch(/^Due today at/);
    expect(dueLabel(DUE, new Date(2026, 9, 11, 19, 0))).toMatch(/^Due tomorrow at/);
    expect(dueLabel(DUE, new Date(2026, 9, 8, 9, 0))).toBe("Due in 4 days");
    expect(dueLabel(DUE, new Date(2026, 9, 14, 9, 0))).toBe("Overdue by 1 day");
    expect(dueLabel(DUE, new Date(2026, 9, 12, 23, 29))).toBe("Due in 30 min");
  });
});
