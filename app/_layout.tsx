import { useEffect, useState } from "react";
import { StatusBar as RNStatusBar, Linking } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, { useSharedValue, useAnimatedStyle, withTiming, withDelay, Easing } from "react-native-reanimated";
import * as ExpoSplashScreen from "expo-splash-screen";
import "../global.css";
import { Stack, useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { Logo } from "@/components/Logo";
import { AlarmOverlay } from "@/components/AlarmOverlay";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { Onboarding } from "@/components/onboarding/Onboarding";
import { useThemeStore } from "@/stores/theme-store";
import { settingsStorage } from "@/stores/mmkv";
import { useSettingsStore } from "@/stores/settings-store";
import { Host } from "@expo/ui";
import { useNotifications } from "@/services/notification-service";
import { useAutoSync } from "@/hooks/useAutoSync";
// Defines the background sync task at module load (required by the OS scheduler).
import "@/services/background-sync";
import { ThemeProvider, ThemeScope, useTheme } from "@/theme/ThemeProvider";

ExpoSplashScreen.preventAutoHideAsync();

function SplashScreen() {
  const logoScale = useSharedValue(0.3);
  const logoOpacity = useSharedValue(0);
  const bgOpacity = useSharedValue(1);

  const logoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: logoScale.value }],
    opacity: logoOpacity.value,
  }));

  const bgStyle = useAnimatedStyle(() => ({
    opacity: bgOpacity.value,
  }));

  useEffect(() => {
    ExpoSplashScreen.hideAsync();
    logoOpacity.value = withTiming(1, { duration: 200 });
    logoScale.value = withTiming(1, { duration: 300, easing: Easing.out(Easing.cubic) });
    bgOpacity.value = withDelay(200, withTiming(0, { duration: 150 }));
  }, []);

  return (
    <Animated.View className="flex-1 bg-white items-center justify-center" style={bgStyle}>
      <Animated.View style={logoStyle}>
        <Logo size={120} />
      </Animated.View>
    </Animated.View>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppShell />
    </ThemeProvider>
  );
}

function AppShell() {
  const { colors: T, dark } = useTheme();
  const barStyle = dark ? "light-content" : "dark-content";
  const [phase, setPhase] = useState<"splash" | "loading" | "onboarding" | "app">("splash");
  const router = useRouter();
  useNotifications();
  useAutoSync();
  // Settings (incl. the AI key from the Keystore) are needed app-wide — e.g.
  // Smart capture — not only once the Settings or Agent tab has been opened.
  useEffect(() => { useSettingsStore.getState().loadSettings(); }, []);

  useEffect(() => {
    const seen = settingsStorage.getBoolean("hasSeenOnboarding");
    // Short branded beat, then straight in: the stores read synchronously from
    // MMKV, so there's nothing to wait for (was a fixed 600 ms delay).
    const t = setTimeout(() => {
      setPhase(seen ? "app" : "onboarding");
    }, 350);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (phase !== "app") return;
    // "Open app on" preference (read once: changing it mid-session must not jump tabs).
    const start = useThemeStore.getState().startTab;
    const home = start === "index" ? "/(tabs)" : (`/(tabs)/${start}` as const);
    // Opened from a widget / link: that route navigates itself — don't
    // override it with the home tab.
    Linking.getInitialURL()
      .then((url) => {
        if (!url || !/^seishin:\/\/\/?open\b/.test(url)) router.replace(home);
      })
      .catch(() => router.replace(home));
  }, [phase]);

  if (phase === "splash") {
    return <SplashScreen />;
  }

  if (phase === "onboarding") {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={{ flex: 1 }}>
          <RNStatusBar backgroundColor={T.white} barStyle={barStyle} />
          <StatusBar style={dark ? "light" : "dark"} />
          <Onboarding
            onDone={() => {
              settingsStorage.set("hasSeenOnboarding", true);
              setPhase("app");
            }}
          />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <Host style={{ flex: 1 }}>
        <SafeAreaProvider>
          <SafeAreaView edges={["top"]} style={{ flex: 1 }}>
            <RNStatusBar backgroundColor={T.white} barStyle={barStyle} />
            <StatusBar style={dark ? "light" : "dark"} />
            <Stack screenOptions={{ headerShown: false, animation: "fade_from_bottom", contentStyle: { backgroundColor: T.white } }}>
              <Stack.Screen name="(tabs)" options={{ animation: "fade" }} />
              <Stack.Screen name="todo" options={{ animation: "slide_from_right" }} />
              <Stack.Screen name="invites" options={{ animation: "slide_from_right" }} />
              <Stack.Screen name="note" options={{ animation: "slide_from_right" }} />
              <Stack.Screen name="capture" options={{ animation: "slide_from_bottom" }} />
              <Stack.Screen name="task" options={{ animation: "slide_from_right" }} />
              <Stack.Screen name="connectors" options={{ animation: "slide_from_right" }} />
              <Stack.Screen name="open" options={{ animation: "none" }} />
            </Stack>
            {/* The alarm screen is designed dark-on-light-ink; pin it to the base palette. */}
            <ThemeScope theme="light">
              <AlarmOverlay />
            </ThemeScope>
          </SafeAreaView>
        </SafeAreaProvider>
        </Host>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
