import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal, StatusBar } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  withSequence,
  Easing,
  FadeInDown,
  FadeIn,
} from "react-native-reanimated";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlarmStore } from "@/stores/alarm-store";
import { startAlarmRinging, stopAlarmRinging } from "@/services/notification-service";
import splashLogo from "../../assets/splash-icon.png";

function formatTime(iso?: string): string {
  if (!iso) return "--:--";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "--:--";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function AlarmOverlay() {
  const alarm = useAlarmStore((s) => s.alarm);
  const dismiss = useAlarmStore((s) => s.dismiss);
  const insets = useSafeAreaInsets();
  const [now, setNow] = useState(new Date());

  const bellRotate = useSharedValue(0);
  const halo1Scale = useSharedValue(1);
  const halo1Opacity = useSharedValue(0.6);
  const halo2Scale = useSharedValue(1);
  const halo2Opacity = useSharedValue(0.6);
  const logoScale = useSharedValue(1);

  useEffect(() => {
    if (!alarm) return;
    // Ring the (selected/default) alarm sound on a loop while visible.
    startAlarmRinging();
    const t = setInterval(() => setNow(new Date()), 1000);

    // Gentle "bell" wobble on the logo.
    bellRotate.value = withRepeat(
      withSequence(
        withTiming(0.14, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(-0.14, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );

    // Breathing logo.
    logoScale.value = withRepeat(
      withTiming(1.06, { duration: 1400, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );

    // Two staggered radar-style halos pulsing outward.
    halo1Scale.value = withRepeat(withTiming(1.9, { duration: 2400, easing: Easing.out(Easing.ease) }), -1, false);
    halo1Opacity.value = withRepeat(withTiming(0, { duration: 2400, easing: Easing.out(Easing.ease) }), -1, false);
    halo2Scale.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1200 }),
        withTiming(1.9, { duration: 2400, easing: Easing.out(Easing.ease) }),
      ),
      -1,
      false,
    );
    halo2Opacity.value = withRepeat(
      withSequence(
        withTiming(0.6, { duration: 1200 }),
        withTiming(0, { duration: 2400, easing: Easing.out(Easing.ease) }),
      ),
      -1,
      false,
    );

    return () => {
      stopAlarmRinging();
      clearInterval(t);
      bellRotate.value = 0;
      logoScale.value = 1;
      halo1Scale.value = 1;
      halo1Opacity.value = 0.6;
      halo2Scale.value = 1;
      halo2Opacity.value = 0.6;
    };
  }, [alarm]);

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${bellRotate.value}rad` }, { scale: logoScale.value }],
  }));
  const halo1Style = useAnimatedStyle(() => ({
    transform: [{ scale: halo1Scale.value }],
    opacity: halo1Opacity.value,
  }));
  const halo2Style = useAnimatedStyle(() => ({
    transform: [{ scale: halo2Scale.value }],
    opacity: halo2Opacity.value,
  }));

  const dismissSpring = useSharedValue(1);
  const snoozeSpring = useSharedValue(1);
  const dismissStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(dismissSpring.value) }],
  }));
  const snoozeStyle = useAnimatedStyle(() => ({
    transform: [{ scale: withSpring(snoozeSpring.value) }],
  }));

  const alarmDate = alarm?.startTime ? new Date(alarm.startTime) : null;
  const nowClock = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const startLabel = formatTime(alarm?.startTime);
  const endLabel = alarm?.endTime ? formatTime(alarm.endTime) : null;
  const timeRange = endLabel && endLabel !== "--:--" ? `${startLabel} – ${endLabel}` : startLabel;

  return (
    <Modal visible={!!alarm} animationType="fade" transparent={false} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#0A0A0F" />
      <View className="flex-1 bg-[#0A0A0F]" style={{ paddingTop: insets.top }}>
        {/* Ambient background glow layers (monochrome per design system) */}
        <View className="absolute inset-0" pointerEvents="none">
          <View className="absolute -top-24 -left-16 w-72 h-72 rounded-full bg-white/[0.05]" />
          <View className="absolute top-1/3 -right-20 w-80 h-80 rounded-full bg-white/[0.04]" />
          <View className="absolute -bottom-24 left-1/4 w-72 h-72 rounded-full bg-white/[0.03]" />
        </View>

        <View className="flex-1 px-8 pb-12 pt-10 items-center justify-between">
          {/* Top: snoozed indicator (no generic ALARM label) */}
          <Animated.View entering={FadeIn.delay(60).duration(500)} className="items-center mt-2" style={{ minHeight: 30 }}>
            {alarm?.snoozed ? (
              <View className="flex-row items-center gap-2 px-4 py-1.5 rounded-full bg-white/[0.06] border border-white/10">
                <View className="w-1.5 h-1.5 rounded-full bg-success" />
                <Text className="text-white/70 text-[11px] font-semibold tracking-[0.3em]">
                  SNOOZED
                </Text>
              </View>
            ) : null}
          </Animated.View>

          {/* Center: pulsing logo + time */}
          <View className="items-center">
            <View className="items-center justify-center mb-10" style={{ height: 128 }}>
              <Animated.View
                className="w-32 h-32 rounded-full bg-white/[0.08]"
                style={[{ position: "absolute" }, halo1Style]}
              />
              <Animated.View
                className="w-32 h-32 rounded-full bg-white/[0.06]"
                style={[{ position: "absolute" }, halo2Style]}
              />
              <View className="w-28 h-28 rounded-full bg-white/[0.05] border border-white/10 items-center justify-center">
                <Animated.View style={bellStyle}>
                  <Image source={splashLogo} style={{ width: 60, height: 60 }} contentFit="contain" />
                </Animated.View>
              </View>
            </View>

            {/* Event title as the hero */}
            <Animated.View entering={FadeInDown.delay(120).duration(550)} className="items-center px-2">
              <Text className="text-white text-3xl font-bold text-center leading-tight" numberOfLines={3}>
                {alarm?.title}
              </Text>
            </Animated.View>

            {/* Start – end time range */}
            <Animated.View entering={FadeInDown.delay(200).duration(550)} className="items-center mt-5">
              <Text className="text-white/90 text-2xl font-light tabular-nums tracking-tight">
                {timeRange}
              </Text>
              {alarmDate && (
                <Text className="text-white/40 text-sm font-medium mt-2 tabular-nums tracking-wide">
                  {alarmDate.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
                </Text>
              )}
            </Animated.View>

            {/* Notes, only if present */}
            {alarm?.notes ? (
              <Animated.View entering={FadeInDown.delay(260).duration(550)} className="items-center mt-6 px-2">
                <View className="h-px w-14 bg-white/15 mb-5" />
                <Text className="text-white/55 text-base text-center leading-relaxed" numberOfLines={5}>
                  {alarm.notes}
                </Text>
              </Animated.View>
            ) : null}
          </View>

          {/* Bottom: actions */}
          <Animated.View
            entering={FadeInDown.delay(280).duration(500)}
            className="items-center w-full"
            style={{ paddingBottom: Math.max(insets.bottom, 20) + 20 }}
          >
            <View className="flex-row items-center gap-1.5 mb-8">
              <Feather name="clock" size={11} color="rgba(255,255,255,0.3)" />
              <Text className="text-white/30 text-xs font-medium tabular-nums tracking-widest">
                {nowClock}
              </Text>
            </View>
            <View className="flex-row items-center gap-4 w-full">
              <Animated.View style={[snoozeStyle, { flex: 1 }]}>
                <TouchableOpacity
                  onPressIn={() => (snoozeSpring.value = 0.94)}
                  onPressOut={() => (snoozeSpring.value = 1)}
                  onPress={async () => {
                    stopAlarmRinging();
                    const { snoozeAlarm } = await import("@/services/notification-service");
                    snoozeAlarm();
                    dismiss();
                  }}
                  className="h-16 rounded-2xl bg-white/[0.07] border border-white/15 items-center justify-center flex-row gap-2.5"
                  activeOpacity={0.85}
                >
                  <Feather name="clock" size={17} color="#ffffff" />
                  <Text className="text-white text-base font-semibold">Snooze</Text>
                </TouchableOpacity>
              </Animated.View>
              <Animated.View style={[dismissStyle, { flex: 1 }]}>
                <TouchableOpacity
                  onPressIn={() => (dismissSpring.value = 0.94)}
                  onPressOut={() => (dismissSpring.value = 1)}
                  onPress={() => { stopAlarmRinging(); dismiss(); }}
                  className="h-16 rounded-2xl bg-white items-center justify-center flex-row gap-2.5"
                  activeOpacity={0.9}
                >
                  <Feather name="x" size={17} color="#0A0A0F" />
                  <Text className="text-[#0A0A0F] text-base font-bold">Dismiss</Text>
                </TouchableOpacity>
              </Animated.View>
            </View>
          </Animated.View>
        </View>
      </View>
    </Modal>
  );
}
