import type { CalendarItem } from "./calendar-utils";
import { minutesOf } from "./calendar-utils";

export interface PlacedEvent {
  item: CalendarItem;
  start: number;
  end: number;
  col: number;
  cols: number;
}

const DAY_END = 24 * 60;
const MIN_SPAN = 20;

/** Start/end minutes of a timed event, clamped into the day. */
export function spanOf(item: CalendarItem): { start: number; end: number } | null {
  const start = minutesOf(item.startDate);
  if (start === null) return null;
  let end = minutesOf(item.endDate) ?? start + 60;
  if (end <= start) end = Math.min(start + 60, DAY_END);
  return { start, end: Math.max(Math.min(end, DAY_END), start + MIN_SPAN) };
}

/**
 * Side-by-side layout for overlapping events (like Google Calendar's day
 * view): each overlap cluster is split into as many columns as it needs.
 */
export function layoutEvents(items: CalendarItem[]): PlacedEvent[] {
  const spans = items
    .map((item) => ({ item, span: spanOf(item) }))
    .filter((x): x is { item: CalendarItem; span: { start: number; end: number } } => x.span !== null)
    .sort((a, b) => a.span.start - b.span.start || b.span.end - a.span.end);

  const out: PlacedEvent[] = [];
  let cluster: PlacedEvent[] = [];
  let colEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const p of cluster) p.cols = colEnds.length;
    out.push(...cluster);
    cluster = [];
    colEnds = [];
    clusterEnd = -1;
  };

  for (const { item, span } of spans) {
    if (cluster.length && span.start >= clusterEnd) flush();
    let col = colEnds.findIndex((end) => end <= span.start);
    if (col < 0) {
      col = colEnds.length;
      colEnds.push(span.end);
    } else {
      colEnds[col] = span.end;
    }
    cluster.push({ item, start: span.start, end: span.end, col, cols: 1 });
    clusterEnd = Math.max(clusterEnd, span.end);
  }
  flush();
  return out;
}
