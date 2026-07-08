import { useEffect, useRef, useState } from "react";
import { Text, Animated } from "react-native";
import "../global.css";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { Logo } from "@/components/Logo";

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }).start(() => setShowSplash(false));
    }, 1200);
    return () => clearTimeout(timer);
  }, [opacity]);

  if (showSplash) {
    return (
      <Animated.View
        className="flex-1 bg-white items-center justify-center"
        style={{ opacity }}
      >
        <Logo size={100} />
        <Text className="text-xl font-semibold tracking-tight text-black mt-6">
          Seishin
        </Text>
        <Text className="text-sm text-ink-300 mt-1">Life Manager</Text>
      </Animated.View>
    );
  }

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
      </Stack>
    </>
  );
}
