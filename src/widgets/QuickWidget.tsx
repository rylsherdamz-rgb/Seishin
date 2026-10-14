import { FlexWidget, SvgWidget, TextWidget } from "react-native-android-widget";
import type { Palette } from "@/theme/themes";
import { hex, openLink } from "./theme";
import { RADIUS } from "./ui";

/** 24×24 line icons; launcher fonts can't be trusted to have symbol glyphs. */
const ICONS = {
  event: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  task: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>',
  scan: '<path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2M7 12h10"/>',
  note: '<path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4zM13.5 6.5l4 4"/>',
};

const icon = (path: string, color: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`;

const ACTIONS: { to: string; icon: keyof typeof ICONS; label: string; params?: Record<string, string> }[] = [
  { to: "new-event", icon: "event", label: "Event" },
  { to: "new-task", icon: "task", label: "Task" },
  { to: "capture", icon: "scan", label: "Scan", params: { source: "camera" } },
  { to: "new-note", icon: "note", label: "Note" },
];

/** One-tap capture bar: new event, task, scan an assignment, note. */
export function QuickWidget({ P }: { P: Palette }) {
  return (
    <FlexWidget
      style={{ height: "match_parent", width: "match_parent", flexDirection: "row", backgroundColor: hex(P.white), borderRadius: RADIUS, padding: 6, alignItems: "center" }}
    >
      {ACTIONS.map((a) => (
        <FlexWidget
          key={a.to}
          {...openLink(a.to, a.params)}
          accessibilityLabel={`New ${a.label.toLowerCase()}`}
          style={{ flex: 1, height: "match_parent", marginHorizontal: 3, borderRadius: 18, backgroundColor: hex(P.ink50), flexDirection: "column", alignItems: "center", justifyContent: "center" }}
        >
          <SvgWidget svg={icon(ICONS[a.icon], P.accent)} style={{ width: 20, height: 20 }} />
          <TextWidget text={a.label} style={{ fontSize: 11, fontWeight: "600", color: hex(P.black), marginTop: 2 }} />
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}
