import { FlexWidget, ListWidget, TextWidget } from "react-native-android-widget";
import type { Palette } from "@/theme/themes";
import { headerDate, type AgendaDay } from "./widget-data";
import { hex, openLink } from "./theme";
import { EmptyLine, ItemRow, PlusButton, SectionLabel, Shell } from "./ui";

/** Today at a glance: big date, then today's and tomorrow's events and deadlines. */
export function AgendaWidget({ P, days, now }: { P: Palette; days: AgendaDay[]; now: Date }) {
  const h = headerDate(now);
  const total = days.reduce((n, d) => n + d.rows.length, 0);
  return (
    <Shell P={P}>
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center" }}>
        <FlexWidget {...openLink("day", { date: days[0]?.day ?? "" })} style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
          <TextWidget text={h.date} style={{ fontSize: 34, fontWeight: "700", color: hex(P.accent), marginRight: 10 }} />
          <FlexWidget style={{ flexDirection: "column" }}>
            <TextWidget text={h.weekday} style={{ fontSize: 14, fontWeight: "700", color: hex(P.black) }} />
            <TextWidget text={h.month} style={{ fontSize: 12, color: hex(P.ink500) }} />
          </FlexWidget>
        </FlexWidget>
        <PlusButton P={P} to="new-event" params={{ date: days[0]?.day ?? "" }} />
      </FlexWidget>
      {total === 0 ? (
        <EmptyLine P={P} text="Nothing scheduled — enjoy the free time." />
      ) : (
        <ListWidget style={{ height: "match_parent", width: "match_parent" }}>
          {days.flatMap((d, i) =>
            d.rows.length === 0 && i > 0
              ? []
              : [
                  <FlexWidget key={`h-${d.day}`} style={{ width: "match_parent" }}>
                    <SectionLabel P={P} text={d.rows.length ? d.label : `${d.label} · free`} accent={i === 0} />
                  </FlexWidget>,
                  ...d.rows.map((r) => (
                    <FlexWidget key={r.id} style={{ width: "match_parent" }}>
                      <ItemRow P={P} row={r} checkable />
                    </FlexWidget>
                  )),
                ],
          )}
        </ListWidget>
      )}
    </Shell>
  );
}
