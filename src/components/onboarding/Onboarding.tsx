import { memo, useCallback, useRef, useState } from "react";
import { View, Text, TouchableOpacity, useWindowDimensions, ScrollView } from "react-native";
import Animated, {
  interpolate, Extrapolation, useAnimatedScrollHandler, useAnimatedStyle, useSharedValue, type SharedValue,
} from "react-native-reanimated";
import Feather from "@expo/vector-icons/Feather";
import { Logo } from "@/components/Logo";
import { AppearancePicker } from "@/components/AppearancePicker";
import { ClockControls } from "@/components/settings/DisplayControls";
import { useColors } from "@/theme/ThemeProvider";

type FeatherName = React.ComponentProps<typeof Feather>["name"];

interface Page {
  key: string;
  eyebrow: string;
  title: string;
  body: string;
  icons?: FeatherName[];
}

const PAGES: Page[] = [
  { key: "welcome", eyebrow: "Welcome", title: "A calmer way\nto run your day.", body: "Calendar, tasks, notes and an AI assistant — in one quiet place." },
  { key: "plan", eyebrow: "Plan", title: "Everything on\none timeline.", body: "Events, repeating schedules and todos share a single calendar, with alarms that actually ring.", icons: ["calendar", "repeat", "bell"] },
  { key: "capture", eyebrow: "Capture", title: "Notes that read\nfor you.", body: "Snap a photo and Seishin pulls the text out. Attach files, tag ideas, summarise YouTube.", icons: ["camera", "file-text", "youtube"] },
  { key: "private", eyebrow: "Private", title: "Yours. Offline.\nNo account.", body: "Everything stays on this device. Run the AI locally, or bring your own key — your call.", icons: ["lock", "cpu", "wifi-off"] },
  { key: "personalize", eyebrow: "Make it yours", title: "Pick your look.", body: "You can change any of this later in Settings." },
];

const Dot = memo(function Dot({ index, progress }: { index: number; progress: SharedValue<number> }) {
  const style = useAnimatedStyle(() => {
    const d = Math.abs(progress.value - index);
    return {
      width: interpolate(d, [0, 1], [22, 6], Extrapolation.CLAMP),
      opacity: interpolate(d, [0, 1], [1, 0.3], Extrapolation.CLAMP),
    };
  });
  return <Animated.View className="h-1.5 rounded-full bg-accent" style={style} />;
});

const FeaturePage = memo(function FeaturePage({ page, width }: { page: Page; width: number }) {
  const C = useColors();
  return (
    <ScrollView style={{ width }} contentContainerClassName="flex-grow px-8 py-6 justify-center" showsVerticalScrollIndicator={false} bounces={false}>
      {page.key === "welcome" ? (
        <View className="mb-10">
          <Logo size={88} />
        </View>
      ) : (
        <View className="flex-row gap-3 mb-10">
          {page.icons?.map((icon, i) => (
            <View key={icon} className={`w-14 h-14 rounded-2xl items-center justify-center ${i === 0 ? "bg-accent" : "bg-ink-100"}`}>
              <Feather name={icon} size={22} color={i === 0 ? C.onAccent : C.black} />
            </View>
          ))}
        </View>
      )}
      <Text className="text-xs font-bold text-accent uppercase tracking-widest mb-3">{page.eyebrow}</Text>
      <Text className="text-4xl font-bold tracking-tightest text-black" accessibilityRole="header">{page.title}</Text>
      <Text className="text-base text-ink-500 mt-4 leading-6 max-w-[320px]">{page.body}</Text>
    </ScrollView>
  );
});

const PersonalizePage = memo(function PersonalizePage({ page, width }: { page: Page; width: number }) {
  return (
    <ScrollView style={{ width }} contentContainerClassName="px-8 pt-10 pb-8" showsVerticalScrollIndicator={false}>
      <Text className="text-xs font-bold text-accent uppercase tracking-widest mb-3">{page.eyebrow}</Text>
      <Text className="text-3xl font-bold tracking-tightest text-black mb-2" accessibilityRole="header">{page.title}</Text>
      <Text className="text-sm text-ink-500 mb-6">{page.body}</Text>
      <AppearancePicker />
      <View className="h-6" />
      <ClockControls />
    </ScrollView>
  );
});

/** First-run walkthrough; the last page sets theme, accent, clock and week start. */
export function Onboarding({ onDone }: { onDone: () => void }) {
  const C = useColors();
  const { width } = useWindowDimensions();
  const scrollRef = useRef<Animated.ScrollView>(null);
  const progress = useSharedValue(0);
  const [step, setStep] = useState(0);
  const last = PAGES.length - 1;

  const onScroll = useAnimatedScrollHandler((e) => {
    progress.value = e.contentOffset.x / Math.max(1, e.layoutMeasurement.width);
  });

  const goTo = useCallback((i: number) => {
    scrollRef.current?.scrollTo({ x: i * width, animated: true });
    setStep(i);
  }, [width]);

  return (
    <View className="flex-1 bg-white">
      <View className="h-12 px-6 flex-row items-center justify-between">
        <View className="flex-row items-center gap-1.5">
          {PAGES.map((p, i) => <Dot key={p.key} index={i} progress={progress} />)}
        </View>
        {step < last ? (
          <TouchableOpacity onPress={() => goTo(last)} hitSlop={12} accessibilityRole="button">
            <Text className="text-sm font-semibold text-ink-400">Skip</Text>
          </TouchableOpacity>
        ) : null}
      </View>

      <Animated.ScrollView
        ref={scrollRef}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onMomentumScrollEnd={(e) => setStep(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ flex: 1 }}
      >
        {PAGES.map((p) =>
          p.key === "personalize"
            ? <PersonalizePage key={p.key} page={p} width={width} />
            : <FeaturePage key={p.key} page={p} width={width} />,
        )}
      </Animated.ScrollView>

      <View className="px-6 pb-6 pt-2 flex-row gap-3">
        {step > 0 ? (
          <TouchableOpacity
            onPress={() => goTo(step - 1)}
            accessibilityRole="button"
            accessibilityLabel="Back"
            className="w-14 h-14 rounded-2xl bg-ink-100 items-center justify-center"
            activeOpacity={0.8}
          >
            <Feather name="arrow-left" size={20} color={C.black} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => (step === last ? onDone() : goTo(step + 1))}
          accessibilityRole="button"
          className="flex-1 h-14 rounded-2xl bg-accent flex-row items-center justify-center gap-2 shadow-raised"
          activeOpacity={0.85}
        >
          <Text className="text-base font-semibold text-accent-on">
            {step === 0 ? "Get started" : step === last ? "Start using Seishin" : "Continue"}
          </Text>
          <Feather name={step === last ? "check" : "arrow-right"} size={18} color={C.onAccent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}
