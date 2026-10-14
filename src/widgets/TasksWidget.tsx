import { FlexWidget, ListWidget, TextWidget } from "react-native-android-widget";
import type { Palette } from "@/theme/themes";
import type { WidgetRow } from "./widget-data";
import { hex, openLink } from "./theme";
import { EmptyLine, ItemRow, PlusButton, Shell } from "./ui";

/** Open tasks with tap-to-complete circles; overdue first. */
export function TasksWidget({ P, rows }: { P: Palette; rows: WidgetRow[] }) {
  const overdue = rows.filter((r) => r.overdue).length;
  return (
    <Shell P={P}>
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", marginBottom: 4 }}>
        <FlexWidget {...openLink("tasks")} style={{ flex: 1, flexDirection: "column" }}>
          <TextWidget text="Tasks" style={{ fontSize: 17, fontWeight: "700", color: hex(P.black) }} />
          <TextWidget
            text={rows.length === 0 ? "All clear" : overdue ? `${rows.length} open · ${overdue} overdue` : `${rows.length} open`}
            style={{ fontSize: 12, color: hex(overdue ? P.danger : P.ink500) }}
          />
        </FlexWidget>
        <PlusButton P={P} to="new-task" />
      </FlexWidget>
      {rows.length === 0 ? (
        <EmptyLine P={P} text="Nothing to do. Tap + to add a task." />
      ) : (
        <ListWidget style={{ height: "match_parent", width: "match_parent" }}>
          {rows.map((r) => (
            <FlexWidget key={r.id} style={{ width: "match_parent" }}>
              <ItemRow P={P} row={r} checkable />
            </FlexWidget>
          ))}
        </ListWidget>
      )}
    </Shell>
  );
}
