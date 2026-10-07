import { View, Text, TouchableOpacity } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useThemeStore } from "@/stores/theme-store";
import { useTheme } from "@/theme/ThemeProvider";
import { ACCENTS, ACCENT_ORDER, THEMES, THEME_ORDER, buildPalette, type ThemeMode } from "@/theme/themes";

/** Settings block: pick a theme (or follow the system) and an accent color. */
export function AppearancePicker() {
  const mode = useThemeStore((s) => s.mode);
  const accent = useThemeStore((s) => s.accent);
  const setMode = useThemeStore((s) => s.setMode);
  const setAccent = useThemeStore((s) => s.setAccent);
  const { colors: C, dark } = useTheme();

  const options: ThemeMode[] = ["system", ...THEME_ORDER];
  return (
    <View>
      <View className="flex-row flex-wrap gap-2.5">
        {options.map((m) => (
          <ThemeSwatch key={m} mode={m} active={mode === m} onPress={() => setMode(m)} />
        ))}
      </View>

      <Text className="text-xs font-semibold text-ink-400 mt-5 mb-2.5">Accent color</Text>
      <View className="flex-row flex-wrap gap-3">
        {ACCENT_ORDER.map((id) => {
          const a = ACCENTS[id];
          const hex = (dark ? a.dark : a.light) ?? C.black;
          const active = accent === id;
          return (
            <TouchableOpacity
              key={id}
              onPress={() => setAccent(id)}
              activeOpacity={0.7}
              className="items-center gap-1.5"
              accessibilityLabel={`${a.name} accent`}
              accessibilityState={{ selected: active }}
            >
              <View
                className={`w-11 h-11 rounded-full items-center justify-center ${active ? "border-2 border-black" : "border border-ink-100"}`}
              >
                <View className="w-8 h-8 rounded-full items-center justify-center" style={{ backgroundColor: hex }}>
                  {active && <Feather name="check" size={14} color={id === "mono" ? C.white : dark ? "#0b0b0b" : "#ffffff"} />}
                </View>
              </View>
              <Text className={`text-[11px] ${active ? "font-bold text-black" : "text-ink-400"}`}>{a.name}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

/** Mini preview card showing the theme's page, ink and a sample event. */
function ThemeSwatch({ mode, active, onPress }: { mode: ThemeMode; active: boolean; onPress: () => void }) {
  const accentId = useThemeStore((s) => s.accent);
  const isSystem = mode === "system";
  const theme = THEMES[isSystem ? "light" : mode];
  const p = buildPalette(theme, ACCENTS[accentId]);
  const dark = isSystem ? buildPalette(THEMES.dark, ACCENTS[accentId]) : null;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.8}
      className={`rounded-2xl p-1 ${active ? "border-2 border-accent" : "border-2 border-transparent"}`}
      style={{ width: "31%" }}
      accessibilityState={{ selected: active }}
    >
      <View className="h-20 rounded-xl overflow-hidden flex-row border border-ink-100">
        <MiniPreview p={p} />
        {dark && <MiniPreview p={dark} />}
      </View>
      <Text className={`text-xs mt-1.5 text-center ${active ? "font-bold text-black" : "font-medium text-ink-500"}`} numberOfLines={1}>
        {isSystem ? "System" : theme.name}
      </Text>
    </TouchableOpacity>
  );
}

function MiniPreview({ p }: { p: ReturnType<typeof buildPalette> }) {
  return (
    <View className="flex-1 p-2 gap-1.5" style={{ backgroundColor: p.white }}>
      <View className="h-1.5 w-8 rounded-full" style={{ backgroundColor: p.black }} />
      <View className="h-1 w-12 rounded-full" style={{ backgroundColor: p.ink200 }} />
      <View className="flex-row rounded-md overflow-hidden mt-1" style={{ backgroundColor: p.ink75 }}>
        <View className="w-1" style={{ backgroundColor: p.accent }} />
        <View className="h-4 flex-1" />
      </View>
      <View className="h-4 rounded-md" style={{ backgroundColor: p.ink75 }} />
    </View>
  );
}
