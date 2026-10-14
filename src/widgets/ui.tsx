import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { Palette } from "@/theme/themes";
import type { WidgetRow } from "./widget-data";
import { hex, openLink } from "./theme";

export const RADIUS = 24;

/** Rounded page-colored card every widget sits on. */
export function Shell({ P, children, padding = 14 }: { P: Palette; children: React.ReactNode; padding?: number }) {
  return (
    <FlexWidget
      style={{ height: "match_parent", width: "match_parent", flexDirection: "column", backgroundColor: hex(P.white), borderRadius: RADIUS, padding }}
    >
      {children}
    </FlexWidget>
  );
}

/** Round "+" button. */
export function PlusButton({ P, to, params }: { P: Palette; to: string; params?: Record<string, string> }) {
  return (
    <FlexWidget
      {...openLink(to, params)}
      accessibilityLabel="Add"
      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: hex(P.accent), justifyContent: "center", alignItems: "center" }}
    >
      <TextWidget text="+" style={{ fontSize: 20, color: hex(P.onAccent), fontWeight: "500" }} />
    </FlexWidget>
  );
}

export function SectionLabel({ P, text, accent }: { P: Palette; text: string; accent?: boolean }) {
  return (
    <TextWidget
      text={text.toUpperCase()}
      style={{ fontSize: 11, fontWeight: "700", color: hex(accent ? P.accent : P.ink500), marginTop: 8, marginBottom: 4 }}
    />
  );
}

/** One event/task line: color bar or checkbox, title, time. */
export function ItemRow({ P, row, checkable }: { P: Palette; row: WidgetRow; checkable?: boolean }) {
  const link = row.kind === "task" && row.todoId ? openLink("task", { id: row.todoId }) : openLink("day", { date: row.day });
  const sub = [row.when, row.progress ? `${row.progress} done` : ""].filter(Boolean).join(" · ");
  return (
    <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", paddingVertical: 5 }}>
      {row.kind === "task" && checkable && row.todoId ? (
        <FlexWidget
          clickAction="TOGGLE_TASK"
          clickActionData={{ id: row.todoId }}
          accessibilityLabel={`Mark ${row.title} done`}
          style={{ width: 36, height: 36, justifyContent: "center", alignItems: "center" }}
        >
          <FlexWidget style={{ width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: hex(row.overdue ? P.danger : P.ink300) }} />
        </FlexWidget>
      ) : (
        // Same 36dp gutter as the checkbox so titles line up in mixed lists.
        <FlexWidget style={{ width: 36, height: 30, justifyContent: "center", alignItems: "center" }}>
          <FlexWidget
            style={{ width: 4, height: 30, borderRadius: 2, backgroundColor: hex(row.kind === "task" ? (row.overdue ? P.danger : P.ink300) : P.accent) }}
          />
        </FlexWidget>
      )}
      <FlexWidget {...link} style={{ flex: 1, flexDirection: "column" }}>
        <TextWidget text={row.title} maxLines={1} truncate="END" style={{ fontSize: 14, fontWeight: "500", color: hex(P.black) }} />
        {sub ? <TextWidget text={sub} maxLines={1} truncate="END" style={{ fontSize: 12, color: hex(row.overdue ? P.danger : P.ink500) }} /> : <FlexWidget style={{ height: 0 }} />}
      </FlexWidget>
    </FlexWidget>
  );
}

export function EmptyLine({ P, text }: { P: Palette; text: string }) {
  return <TextWidget text={text} style={{ fontSize: 13, color: hex(P.ink400), marginTop: 6 }} />;
}
