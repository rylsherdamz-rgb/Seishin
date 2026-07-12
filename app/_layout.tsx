import { useEffect, useState, useCallback } from "react";
import { View, Text, TouchableOpacity, StatusBar as RNStatusBar } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withSequence, withDelay, Easing, FadeInDown, FadeIn } from "react-native-reanimated";
import "../global.css";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { Logo } from "@/components/Logo";
import { settingsStorage } from "@/stores/mmkv";

const ONBOARDING_PAGES = [
  {
    icon: "calendar" as const,
    title: "Welcome to Seishin",
    desc: "Your all-in-one life manager. Stay organized, never miss a thing.",
  },
  {
    icon: "cpu" as const,
    title: "AI-Powered",
    desc: "Smart agent helps manage your schedule, todos, and more. Works offline too.",
  },
  {
    icon: "file-text" as const,
    title: "Notes, Photos & Files",
    desc: "Capture ideas as notes. Attach photos, Excel, or any file — scanned photos turn into text automatically.",
  },
  {
    icon: "check-square" as const,
    title: "You're Ready",
    desc: "Everything stays on your device. No accounts, no cloud, no tracking.",
  },
];

function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [step, setStep] = useState(0);
  const page = ONBOARDING_PAGES[step];
  const isLast = step === ONBOARDING_PAGES.length - 1;

  return (
    <View className="flex-1 bg-white">
      <View className="flex-1 items-center justify-center px-8">
        {step === 0 ? (
          <Animated.View entering={FadeInDown.duration(400)}>
            <Logo size={80} />
          </Animated.View>
        ) : (
          <Animated.View key={step} entering={FadeInDown.duration(400)} className="w-20 h-20 bg-ink-100 rounded-full items-center justify-center mb-6">
            <Feather name={page.icon} size={32} color="#000000" />
          </Animated.View>
        )}
        <Animated.Text key={`title-${step}`} entering={FadeInDown.delay(100).duration(350)} className="text-2xl font-semibold tracking-tight text-black text-center mt-6">
          {page.title}
        </Animated.Text>
        <Animated.Text key={`desc-${step}`} entering={FadeInDown.delay(200).duration(350)} className="text-base text-ink-500 text-center mt-3 leading-6">
          {page.desc}
        </Animated.Text>
        <View className="flex-row gap-2 mt-12">
          {ONBOARDING_PAGES.map((_, i) => (
            <View
              key={i}
              className={`w-2 h-2 rounded-full ${i === step ? "bg-black" : "bg-ink-200"}`}
            />
          ))}
        </View>
      </View>
      <View className="px-8 pb-12">
        {isLast ? (
          <TouchableOpacity
            onPress={onComplete}
            className="bg-black h-14 rounded-xl items-center justify-center"
          >
            <Text className="text-white text-base font-semibold">Get Started</Text>
          </TouchableOpacity>
        ) : (
          <View className="flex-row gap-3">
            <TouchableOpacity
              onPress={onComplete}
              className="flex-1 h-14 border border-ink-200 rounded-xl items-center justify-center"
            >
              <Text className="text-black text-sm font-medium">Skip</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setStep(step + 1)}
              className="flex-1 h-14 bg-black rounded-xl items-center justify-center"
            >
              <Text className="text-white text-sm font-semibold">Next</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}

function SplashScreen() {
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const textOpacity = useSharedValue(0);
  const subtitleOpacity = useSharedValue(0);
  const bgOpacity = useSharedValue(1);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const textStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }));

  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleOpacity.value,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  useEffect(() => {
    logoOpacity.value = withTiming(1, { duration: 400 });
    logoScale.value = withTiming(1, { duration: 500, easing: Easing.out(Easing.cubic) });
    textOpacity.value = withDelay(300, withTiming(1, { duration: 300 }));
    subtitleOpacity.value = withDelay(500, withTiming(1, { duration: 300 }));
    bgOpacity.value = withDelay(1800, withTiming(0, { duration: 500 }));
  }, []);

  return (
    <Animated.View className="flex-1 bg-white items-center justify-center" style={bgStyle}>
      <Animated.View style={logoStyle}>
        <Logo size={100} />
      </Animated.View>
      <Animated.Text style={textStyle} className="text-xl font-semibold tracking-tight text-black mt-6">
        Seishin
      </Animated.Text>
      <Animated.Text style={subtitleStyle} className="text-sm text-ink-300 mt-1">
        Life Manager
      </Animated.Text>
    </Animated.View>
  );
}

export default function RootLayout() {
  const [phase, setPhase] = useState<"splash" | "loading" | "onboarding" | "app">("splash");
  const router = useRouter();

  useEffect(() => {
    const seen = settingsStorage.getBoolean("hasSeenOnboarding");
    setTimeout(() => {
      setPhase(seen ? "app" : "onboarding");
    }, 2000);
  }, []);

  useEffect(() => {
    if (phase === "app") {
      router.replace("/(tabs)");
    }
  }, [phase]);

  if (phase === "splash") {
    return <SplashScreen />;
  }

  if (phase === "onboarding") {
    return (
      <SafeAreaProvider>
        <RNStatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
        <StatusBar style="light" />
        <OnboardingScreen
          onComplete={() => {
            settingsStorage.set("hasSeenOnboarding", true);
            setPhase("app");
          }}
        />
      </SafeAreaProvider>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
          <RNStatusBar backgroundColor="#1a1a1a" barStyle="light-content" />
          <StatusBar style="light" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="todo" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="invites" options={{ animation: "slide_from_right" }} />
            <Stack.Screen name="note" options={{ animation: "slide_from_right" }} />
          </Stack>
        </SafeAreaView>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
