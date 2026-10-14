import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { Palette } from "@/theme/themes";
import type { NextUp } from "./widget-data";
import { hex, openLink } from "./theme";
import { Shell } from "./ui";

/** Small: the one next thing — event or deadline — with a countdown. */
export function NextUpWidget({ P, next }: { P: Palette; next: NextUp | null }) {
  const link = next?.kind === "task" && next.todoId ? openLink("task", { id: next.todoId }) : openLink("day", { date: next?.day ?? "" });
  const urgent = !!next && (next.when.startsWith("Overdue") || next.when.startsWith("Now"));
  return (
    <Shell P={P}>
      <FlexWidget {...link} style={{ width: "match_parent", height: "match_parent", flexDirection: "column", justifyContent: "center" }}>
        <TextWidget text={next ? (next.kind === "task" ? "NEXT DEADLINE" : "NEXT UP") : "NEXT UP"} style={{ fontSize: 10, fontWeight: "700", color: hex(P.ink500) }} />
        <TextWidget
          text={next ? next.title : "You're all clear"}
          maxLines={2}
          truncate="END"
          style={{ fontSize: 16, fontWeight: "700", color: hex(P.black), marginTop: 4 }}
        />
        <TextWidget
          text={next ? next.when : "Nothing in the next 7 days"}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 13, fontWeight: "600", color: hex(urgent ? (next!.when.startsWith("Overdue") ? P.danger : P.accent) : P.ink600), marginTop: 2 }}
        />
      </FlexWidget>
    </Shell>
  );
}
