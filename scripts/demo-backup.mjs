#!/usr/bin/env node
/**
 * Writes a Seishin backup full of realistic sample data, dated around today,
 * for Play Store screenshots and the promo recording. Restore it with
 * Settings > Backup & restore > Replace all (export your own backup first).
 *
 *   node scripts/demo-backup.mjs [out.json]
 */
import { writeFileSync } from "node:fs";

const out = process.argv[2] ?? "seishin-demo-backup.json";
const now = new Date();
const day = (offset, h = 23, m = 59) => new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset, h, m).toISOString();
const created = day(-3, 9, 0);
let n = 0;
const id = (p) => `${p}_demo_${++n}`;

const event = (title, offset, h, m, mins, extra = {}) => ({
  id: id("evt"),
  title,
  startDate: day(offset, h, m),
  endDate: new Date(new Date(day(offset, h, m)).getTime() + mins * 60000).toISOString(),
  source: "manual",
  reminder: 15,
  ...extra,
});

const todo = (title, due, extra = {}) => ({
  id: id("todo"),
  title,
  completed: false,
  priority: "medium",
  category: "general",
  tags: [],
  createdAt: created,
  dueDate: due,
  ...extra,
});

const note = (title, body, color, extra = {}) => ({
  id: id("note"),
  title,
  body,
  tags: [],
  pinned: false,
  attachments: [],
  color,
  createdAt: created,
  updatedAt: day(-1, 20, 0),
  ...extra,
});

const events = [
  event("Morning run", 0, 6, 30, 45),
  event("Calculus II lecture", 0, 9, 0, 90),
  event("Design team stand-up", 0, 11, 0, 30),
  event("Lunch with Mara", 0, 12, 30, 60),
  event("Study group: Physics", 0, 15, 0, 120, { notes: "Bring problem set 4" }),
  event("Gym", 0, 18, 30, 60),
  event("Dentist", 1, 10, 0, 45),
  event("Client call", 1, 14, 0, 60),
  event("Movie night", 2, 19, 30, 150),
  event("Farmers market", 3, 8, 0, 90),
  event("Project review", 4, 13, 0, 60),
  event("Calculus II lecture", -1, 9, 0, 90),
  event("Coffee with Sam", -1, 16, 0, 45),
];

const todos = [
  todo("Submit physics lab report", day(-1), { reminder: "persistent" }),
  todo("Read chapter 7 — Thermodynamics", day(0, 17, 0)),
  todo("Reply to landlord about the lease", day(0)),
  todo("Buy groceries", day(0, 19, 0)),
  todo("Calculus problem set 5", day(1, 9, 0), {
    items: [
      { id: id("item"), text: "Integration by parts (1–6)", done: true },
      { id: id("item"), text: "Trig substitution (7–12)", done: true },
      { id: id("item"), text: "Partial fractions (13–18)", done: false },
      { id: id("item"), text: "Improper integrals (19–20)", done: false },
    ],
  }),
  todo("Book flights for December", day(3)),
  todo("Renew library books", day(5)),
  todo("Plan Mara's birthday gift"),
  todo("Clean out the photo library"),
  todo("Pay phone bill", day(-2), { completed: true, completedAt: day(-2, 12, 0) }),
  todo("Email professor about extension", day(-1), { completed: true, completedAt: day(-1, 10, 0) }),
];

const notes = [
  note("Weekly goals", "Run 3×\nFinish problem set 5 early\nCall Mom on Sunday\nNo phone after 11 pm", "lemon", { pinned: true }),
  note("Physics — key formulas", "ΔU = Q − W\nPV = nRT\nη = 1 − Tc/Th\nEntropy always increases in an isolated system.", "sky"),
  note("Gift ideas for Mara", "Film camera\nThat ceramics class\nConcert tickets — check dates", "rose"),
  note("Books to read", "The Overstory\nPiranesi\nFour Thousand Weeks", "mint"),
  note("Trip packing list", "Passport\nCharger + adapter\nRain jacket\nSnacks for the flight", "lavender"),
  note("Meeting notes — design review", "Ship the new onboarding next sprint.\nTasks screen: grouped by Today / Upcoming.\nFollow up on widget previews.", "default"),
];

const backup = { app: "seishin", version: 1, createdAt: now.toISOString(), events, todos, notes, prefs: {} };

writeFileSync(out, JSON.stringify(backup, null, 2));
console.log(`Wrote ${out}: ${events.length} events, ${todos.length} tasks, ${notes.length} notes`);
