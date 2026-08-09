import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, Modal, StatusBar } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSpring,
  FadeInDown,
} from "react-native-reanimated";
import { Image } from "expo-image";
import Feather from "@expo/vector-icons/Feather";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAlarmStore } from "@/stores/alarm-store";
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
  const haloScale = useSharedValue(1);
  const haloOpacity = useSharedValue(0.5);

  useEffect(() => {
    if (!alarm) return;
    const t = setInterval(() => setNow(new Date()), 1000);
    bellRotate.value = withRepeat(
      withTiming(0.16, { duration: 800 }),
      -1,
      true,
    );
    haloScale.value = withRepeat(withTiming(1.35, { duration: 1600 }), -1, true);
    haloOpacity.value = withRepeat(withTiming(0, { duration: 1600 }), -1, true);
    return () => {
      clearInterval(t);
      bellRotate.value = 0;
      haloScale.value = 1;
      haloOpacity.value = 0.5;
    };
  }, [alarm]);

  const bellStyle = useAnimatedStyle(() => ({
    transform: [{ rotateZ: `${bellRotate.value}rad` }],
  }));

  const haloStyle = useAnimatedStyle(() => ({
    transform: [{ scale: haloScale.value }],
    opacity: haloOpacity.value,
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

  return (
    <Modal visible={!!alarm} animationType="fade" transparent={false} statusBarTranslucent>
      <StatusBar barStyle="light-content" backgroundColor="#000000" />
      <View className="flex-1 bg-black px-8 pb-12 pt-16 items-center justify-between">
        <View className="absolute inset-0 items-center justify-center" pointerEvents="none">
          <Animated.View
            className="w-56 h-56 rounded-full bg-white/10"
            style={[{ position: "absolute" }, haloStyle]}
          />
          <Animated.View
            className="w-40 h-40 rounded-full bg-white/[0.07]"
            style={[{ position: "absolute" }, haloStyle]}
          />
        </View>

        <Animated.View entering={FadeInDown.delay(80).duration(450)} className="items-center mt-6">
          <Animated.View style={bellStyle}>
            <Image
              source={splashLogo}
              style={{ width: 72, height: 72 }}
              contentFit="contain"
            />
          </Animated.View>
          <Text className="text-white/50 text-[11px] font-semibold tracking-[0.35em] mt-4">
            {alarm?.snoozed ? "ALARM · SNOOZED" : "ALARM"}
          </Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(120).duration(520)} className="items-center">
          <Text className="text-white text-[96px] font-thin leading-none tabular-nums tracking-tight">
            {formatTime(alarm?.startTime)}
          </Text>
          <View className="h-px w-20 bg-white/25 my-6" />
          <Text className="text-white text-2xl font-semibold text-center" numberOfLines={2}>
            {alarm?.title}
          </Text>
          {alarmDate && (
            <Text className="text-white/50 text-sm font-medium mt-2 tabular-nums">
              {alarmDate.toLocaleDateString([], { weekday: "long", day: "numeric", month: "long" })}
            </Text>
          )}
          {alarm?.body ? (
            <Text className="text-white/40 text-sm mt-1 text-center" numberOfLines={2}>
              {alarm.body}
            </Text>
          ) : null}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(220).duration(450)}
          className="items-center w-full"
          style={{ paddingBottom: Math.max(insets.bottom, 24) + 28 }}
        >
          <Text className="text-white/30 text-xs font-medium tabular-nums tracking-widest mb-7">
            {nowClock}
          </Text>
          <View className="flex-row items-center gap-4 w-full">
            <Animated.View style={[snoozeStyle, { flex: 1 }]}>
              <TouchableOpacity
                onPressIn={() => (snoozeSpring.value = 0.94)}
                onPressOut={() => (snoozeSpring.value = 1)}
                onPress={async () => {
                  const { snoozeAlarm } = await import("@/services/notification-service");
                  snoozeAlarm();
                  dismiss();
                }}
                className="h-14 rounded-full border border-white/30 items-center justify-center flex-row gap-2"
                activeOpacity={0.85}
              >
                <Feather name="clock" size={16} color="#ffffff" />
                <Text className="text-white text-base font-medium">Snooze</Text>
              </TouchableOpacity>
            </Animated.View>
            <Animated.View style={[dismissStyle, { flex: 1 }]}>
              <TouchableOpacity
                onPressIn={() => (dismissSpring.value = 0.94)}
                onPressOut={() => (dismissSpring.value = 1)}
                onPress={dismiss}
                className="h-14 rounded-full bg-white items-center justify-center"
                activeOpacity={0.9}
              >
                <Text className="text-black text-base font-semibold">Dismiss</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}