import { View, Text } from "react-native";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { useThemeStore, type DisplayPrefs } from "@/stores/theme-store";
import { updateWidgetsSoon } from "@/widgets/update";
import type { Density, StartTab, TextSize, TimeFormat } from "@/theme/prefs";

const TIME_OPTIONS: { label: string; value: TimeFormat }[] = [
  { label: "12-hour", value: "12h" },
  { label: "24-hour", value: "24h" },
];
const WEEK_OPTIONS: { label: string; value: "0" | "1" }[] = [
  { label: "Sunday", value: "0" },
  { label: "Monday", value: "1" },
];
const TEXT_OPTIONS: { label: string; value: TextSize }[] = [
  { label: "S", value: "small" },
  { label: "M", value: "default" },
  { label: "L", value: "large" },
  { label: "XL", value: "xlarge" },
];
const DENSITY_OPTIONS: { label: string; value: Density }[] = [
  { label: "Compact", value: "compact" },
  { label: "Default", value: "default" },
  { label: "Roomy", value: "comfortable" },
];
const TAB_OPTIONS: { label: string; value: StartTab }[] = [
  { label: "Calendar", value: "index" },
  { label: "Notes", value: "notes" },
  { label: "Agent", value: "agent" },
];

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <View className="flex-row items-baseline justify-between mb-2">
        <Text className="text-xs font-semibold text-ink-400">{label}</Text>
        {hint ? <Text className="text-xs text-ink-300">{hint}</Text> : null}
      </View>
      {children}
    </View>
  );
}

function useSetPref() {
  const setPref = useThemeStore((s) => s.setPref);
  return <K extends keyof DisplayPrefs>(key: K, value: DisplayPrefs[K]) => {
    setPref(key, value);
    // Widgets render times and the month grid outside React; redraw them.
    if (key === "timeFormat" || key === "weekStart") updateWidgetsSoon(0);
  };
}

/** Clock + week start: also shown during onboarding. */
export function ClockControls() {
  const timeFormat = useThemeStore((s) => s.timeFormat);
  const weekStart = useThemeStore((s) => s.weekStart);
  const set = useSetPref();
  return (
    <>
      <Row label="Clock">
        <SegmentedControl size="small" options={TIME_OPTIONS} value={timeFormat} onChange={(v) => set("timeFormat", v)} />
      </Row>
      <Row label="Week starts on">
        <SegmentedControl
          size="small"
          options={WEEK_OPTIONS}
          value={String(weekStart) as "0" | "1"}
          onChange={(v) => set("weekStart", v === "1" ? 1 : 0)}
        />
      </Row>
    </>
  );
}

/** Settings block: clock, week start, text size, density, start tab. */
export function DisplayControls() {
  const textSize = useThemeStore((s) => s.textSize);
  const density = useThemeStore((s) => s.density);
  const startTab = useThemeStore((s) => s.startTab);
  const set = useSetPref();
  return (
    <View>
      <ClockControls />
      <Row label="Text size">
        <SegmentedControl size="small" options={TEXT_OPTIONS} value={textSize} onChange={(v) => set("textSize", v)} />
      </Row>
      <Row label="Density">
        <SegmentedControl size="small" options={DENSITY_OPTIONS} value={density} onChange={(v) => set("density", v)} />
      </Row>
      <Row label="Open app on" hint="Applies next launch">
        <SegmentedControl size="small" options={TAB_OPTIONS} value={startTab} onChange={(v) => set("startTab", v)} />
      </Row>
    </View>
  );
}
