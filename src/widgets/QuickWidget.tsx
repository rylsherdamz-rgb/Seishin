import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { Palette } from "@/theme/themes";
import { hex, openLink } from "./theme";
import { RADIUS } from "./ui";

const ACTIONS: { to: string; glyph: string; label: string; params?: Record<string, string> }[] = [
  { to: "new-event", glyph: "◷", label: "Event" },
  { to: "new-task", glyph: "✓", label: "Task" },
  { to: "capture", glyph: "◉", label: "Scan", params: { source: "camera" } },
  { to: "new-note", glyph: "✎", label: "Note" },
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
          <TextWidget text={a.glyph} style={{ fontSize: 18, color: hex(P.accent) }} />
          <TextWidget text={a.label} style={{ fontSize: 11, fontWeight: "600", color: hex(P.black), marginTop: 2 }} />
        </FlexWidget>
      ))}
    </FlexWidget>
  );
}
