import { FlexWidget, TextWidget } from "react-native-android-widget";
import type { Palette } from "@/theme/themes";
import type { MonthCell } from "./widget-data";
import { hex, openLink } from "./theme";
import { Shell } from "./ui";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function NavButton({ P, label, action, a11y }: { P: Palette; label: string; action: string; a11y: string }) {
  return (
    <FlexWidget clickAction={action} accessibilityLabel={a11y} style={{ width: 34, height: 30, justifyContent: "center", alignItems: "center", borderRadius: 15 }}>
      <TextWidget text={label} style={{ fontSize: 16, fontWeight: "700", color: hex(P.ink700) }} />
    </FlexWidget>
  );
}

function Cell({ P, c }: { P: Palette; c: MonthCell }) {
  const color = c.today ? P.onAccent : c.inMonth ? P.black : P.ink300;
  return (
    <FlexWidget {...openLink("day", { date: c.key })} style={{ flex: 1, height: "match_parent", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
      <FlexWidget
        style={{ width: 26, height: 26, borderRadius: 13, justifyContent: "center", alignItems: "center", backgroundColor: hex(c.today ? P.accent : "#00000000") }}
      >
        <TextWidget text={String(c.day)} style={{ fontSize: 12, fontWeight: c.today ? "700" : "500", color: hex(color) }} />
      </FlexWidget>
      <FlexWidget
        style={{ width: 4, height: 4, borderRadius: 2, marginTop: 1, backgroundColor: hex(c.count > 0 && c.inMonth ? (c.today ? P.accent : P.ink500) : "#00000000") }}
      />
    </FlexWidget>
  );
}

/** Month grid with event dots; arrows page months, a day opens it in the app. */
export function MonthWidget({ P, title, weeks, isCurrent }: { P: Palette; title: string; weeks: MonthCell[][]; isCurrent: boolean }) {
  return (
    <Shell P={P} padding={10}>
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", alignItems: "center", paddingLeft: 6 }}>
        <FlexWidget clickAction="MONTH_TODAY" accessibilityLabel="Back to this month" style={{ flex: 1 }}>
          <TextWidget text={title} style={{ fontSize: 15, fontWeight: "700", color: hex(isCurrent ? P.black : P.accent) }} />
        </FlexWidget>
        <NavButton P={P} label="‹" action="MONTH_PREV" a11y="Previous month" />
        <NavButton P={P} label="›" action="MONTH_NEXT" a11y="Next month" />
      </FlexWidget>
      <FlexWidget style={{ width: "match_parent", flexDirection: "row", marginTop: 4 }}>
        {WEEKDAYS.map((d, i) => (
          <FlexWidget key={i} style={{ flex: 1, alignItems: "center" }}>
            <TextWidget text={d} style={{ fontSize: 10, fontWeight: "700", color: hex(P.ink400) }} />
          </FlexWidget>
        ))}
      </FlexWidget>
      <FlexWidget style={{ width: "match_parent", flex: 1, flexDirection: "column" }}>
        {weeks.map((w, i) => (
          <FlexWidget key={i} style={{ width: "match_parent", flex: 1, flexDirection: "row" }}>
            {w.map((c) => (
              <Cell key={c.key} P={P} c={c} />
            ))}
          </FlexWidget>
        ))}
      </FlexWidget>
    </Shell>
  );
}
