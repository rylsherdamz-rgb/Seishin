/**
 * Renders each home-screen widget's real component tree (sample data, default
 * Mono Light theme) to PNG for the launcher's widget picker (`previewImage` in
 * app.json). Excluded from the normal test run; regenerate after changing a
 * widget's look:
 *
 *   npm run widget-previews
 *
 * Needs Chromium on PATH (`chromium`) and a prebuild afterwards to copy the
 * images into android/.
 */
import { execFileSync } from "child_process";
import fs from "fs";
import os from "os";
import path from "path";
import { isValidElement, type ReactNode } from "react";
import type { CalendarEvent } from "@/stores/calendar-store";
import type { Todo } from "@/stores/todo-store";
import { ACCENTS, THEMES, buildPalette } from "@/theme/themes";
import { agendaFor, monthGrid, monthTitle, nextUp, tasksFor } from "@/widgets/widget-data";
import { AgendaWidget } from "@/widgets/AgendaWidget";
import { TasksWidget } from "@/widgets/TasksWidget";
import { MonthWidget } from "@/widgets/MonthWidget";
import { NextUpWidget } from "@/widgets/NextUpWidget";
import { QuickWidget } from "@/widgets/QuickWidget";

jest.mock("react-native-android-widget", () => ({
  FlexWidget: "FlexWidget",
  TextWidget: "TextWidget",
  SvgWidget: "SvgWidget",
  ListWidget: "ListWidget",
}));

const OUT = path.join(__dirname, "../../assets/widgets");
const SCALE = 3;

// ---- Sample data: a believable student Thursday --------------------------------

const NOW = new Date(2026, 9, 22, 8, 30);
const at = (day: number, h: number, m = 0) => new Date(2026, 9, day, h, m).toISOString();
const event = (id: string, title: string, day: number, h: number, hours: number): CalendarEvent => ({
  id, title, startDate: at(day, h), endDate: at(day, h + hours), source: "manual",
});
const todo = (id: string, title: string, due: string | undefined, extra: Partial<Todo> = {}): Todo => ({
  id, title, dueDate: due, completed: false, priority: "medium", category: "school", tags: [], createdAt: at(20, 9), ...extra,
});

const EVENTS: CalendarEvent[] = [
  event("e1", "Intro to Computing", 22, 9, 1.5),
  event("e2", "Study group · Library", 22, 13, 1),
  event("e3", "PathFit", 23, 8, 2),
  event("e4", "Geography quiz", 27, 10, 1),
  event("e5", "Org meeting", 29, 16, 1),
  event("e6", "Midterms week", 14, 8, 1),
  event("e7", "Family dinner", 18, 18, 2),
];
const TODOS: Todo[] = [
  todo("t1", "Lab report — Programming 1", at(21, 23, 59)),
  todo("t2", "Essay draft — Purposive Comm", at(22, 17), {
    items: [1, 2, 3, 4, 5].map((n) => ({ id: `i${n}`, text: `Part ${n}`, done: n <= 2 })),
  }),
  todo("t3", "Math problem set 4", at(24, 12)),
  todo("t4", "Read chapter 5", at(26, 20)),
];

const P = buildPalette(THEMES.light, ACCENTS.mono);

const WIDGETS: { file: string; w: number; h: number; tree: ReactNode }[] = [
  { file: "agenda", w: 320, h: 210, tree: <AgendaWidget P={P} now={NOW} days={agendaFor(EVENTS, TODOS, NOW, 3)} /> },
  { file: "tasks", w: 320, h: 210, tree: <TasksWidget P={P} rows={tasksFor(TODOS, NOW)} /> },
  {
    file: "month", w: 320, h: 300,
    tree: <MonthWidget P={P} title={monthTitle(2026, 9)} isCurrent weeks={monthGrid(2026, 9, EVENTS, TODOS, NOW, 0)} />,
  },
  { file: "nextup", w: 160, h: 160, tree: <NextUpWidget P={P} next={nextUp(EVENTS, TODOS, NOW)} /> },
  { file: "quick", w: 320, h: 76, tree: <QuickWidget P={P} /> },
];

// ---- Widget tree -> HTML ----------------------------------------------------------

type Style = Record<string, string | number | undefined>;

/** Android #AARRGGBB (8 digits) or #RRGGBB to CSS. */
function color(c: unknown): string {
  const s = String(c);
  if (/^#[0-9a-f]{8}$/i.test(s)) return `#${s.slice(3)}${s.slice(1, 3)}`;
  return s;
}

const size = (v: unknown) => (v === "match_parent" ? "100%" : v === "wrap_content" ? "auto" : typeof v === "number" ? `${v}px` : String(v));

function css(style: Style = {}, base: string[] = []): string {
  const out = [...base];
  const box = (prop: "padding" | "margin") => {
    const all = style[prop];
    const h = style[`${prop}Horizontal`] ?? all;
    const v = style[`${prop}Vertical`] ?? all;
    const side = (name: string, fallback: unknown) => {
      const val = style[`${prop}${name}`] ?? fallback;
      if (val !== undefined) out.push(`${prop}-${name.toLowerCase()}:${size(val)}`);
    };
    side("Top", v); side("Bottom", v); side("Left", h); side("Right", h);
  };
  box("padding");
  box("margin");
  for (const [k, v] of Object.entries(style)) {
    if (v === undefined) continue;
    switch (k) {
      case "width": out.push(`width:${size(v)}`); break;
      case "height": out.push(`height:${size(v)}`); break;
      case "flex": out.push(`flex:${v} ${v} 0`, "min-width:0", "min-height:0"); break;
      case "flexDirection": out.push(`flex-direction:${v}`); break;
      case "alignItems": out.push(`align-items:${v}`); break;
      case "justifyContent": out.push(`justify-content:${v}`); break;
      case "backgroundColor": out.push(`background:${color(v)}`); break;
      case "borderRadius": out.push(`border-radius:${v}px`); break;
      case "borderWidth": out.push(`border:${v}px solid ${color(style.borderColor ?? "#000")}`); break;
      case "fontSize": out.push(`font-size:${v}px`); break;
      case "fontWeight": out.push(`font-weight:${v}`); break;
      case "color": out.push(`color:${color(v)}`); break;
    }
  }
  return out.join(";");
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function html(node: ReactNode): string {
  if (node === null || node === undefined || typeof node === "boolean") return "";
  if (Array.isArray(node)) return node.map(html).join("");
  if (!isValidElement(node)) return esc(String(node));
  const { type } = node;
  const props = node.props as Record<string, any>;
  if (typeof type === "function") return html((type as (p: unknown) => ReactNode)(props));
  const kids = html(props.children);
  switch (type) {
    case "FlexWidget":
      return `<div style="${css(props.style, ["display:flex", "flex-direction:column", "flex-shrink:0", "box-sizing:border-box", "overflow:hidden"])}">${kids}</div>`;
    case "ListWidget":
      return `<div style="${css(props.style, ["display:flex", "flex-direction:column", "overflow:hidden", "min-height:0", "flex-shrink:1"])}">${kids}</div>`;
    case "TextWidget": {
      const clamp = props.maxLines
        ? ["display:-webkit-box", `-webkit-line-clamp:${props.maxLines}`, "-webkit-box-orient:vertical", "overflow:hidden", "max-width:100%"]
        : ["white-space:nowrap"];
      return `<span style="${css(props.style, [...clamp, "line-height:1.25"])}">${esc(String(props.text ?? ""))}</span>`;
    }
    case "SvgWidget":
      return `<div style="${css(props.style)}">${String(props.svg).replace("<svg ", '<svg width="100%" height="100%" ')}</div>`;
    default:
      throw new Error(`Unknown widget element: ${String(type)}`);
  }
}

function page(w: number, h: number, body: string) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>
html,body{margin:0;background:transparent}
body{font-family:Roboto,"Noto Sans",Arial,sans-serif;-webkit-font-smoothing:antialiased}
#root{width:${w}px;height:${h}px;display:flex;filter:drop-shadow(0 2px 6px rgba(0,0,0,.12))}
</style></head><body><div id="root">${body}</div></body></html>`;
}

test("generate widget previews", () => {
  fs.mkdirSync(OUT, { recursive: true });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "seishin-widgets-"));
  for (const w of WIDGETS) {
    const file = path.join(tmp, `${w.file}.html`);
    fs.writeFileSync(file, page(w.w, w.h, html(w.tree)));
    execFileSync("chromium", [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--hide-scrollbars",
      `--force-device-scale-factor=${SCALE}`, "--default-background-color=00000000",
      `--window-size=${w.w},${w.h}`, `--screenshot=${path.join(OUT, `${w.file}.png`)}`, `file://${file}`,
    ], { stdio: "pipe", timeout: 60000 });
    expect(fs.statSync(path.join(OUT, `${w.file}.png`)).size).toBeGreaterThan(1000);
  }
}, 120000);
