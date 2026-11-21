import { useCallback, useEffect, useState } from "react";
import { Platform, Text, TouchableOpacity } from "react-native";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { useSettingsStore } from "@/stores/settings-store";
import { NativeAlarm } from "@/services/notify-core";
import { pickAlarmRingtone, applyAlarmRingtone } from "@/services/notification-service";
import { RemindersCheck } from "./RemindersCheck";
import { MenuRow, SectionHeader, type Notice } from "./rows";

/** Reminders: diagnostics, the keep-alive service and the alarm sound. */
export function RemindersSection({ onNotice }: { onNotice: Notice }) {
  const ringtoneUri = useSettingsStore((s) => s.alarmRingtoneUri);
  const ringtoneName = useSettingsStore((s) => s.alarmRingtoneName);
  const setRingtone = useSettingsStore((s) => s.setAlarmRingtone);
  // Native foreground service that keeps reminders working while the app is closed.
  const [keepAlive, setKeepAlive] = useState(true);

  useEffect(() => {
    NativeAlarm?.isKeepAliveEnabled?.().then(setKeepAlive).catch(() => {});
  }, []);

  const toggleKeepAlive = (on: boolean) => {
    setKeepAlive(on);
    NativeAlarm?.setKeepAlive?.(on);
  };

  const choose = useCallback(async () => {
    try {
      const result = await pickAlarmRingtone(ringtoneUri);
      if (result === null) return; // cancelled: keep the current sound
      setRingtone(result.uri, result.name);
      applyAlarmRingtone(result.uri);
    } catch {
      onNotice("Ringtone", "Could not open the ringtone picker. Try again.");
    }
  }, [ringtoneUri, setRingtone, onNotice]);

  const reset = useCallback(() => {
    setRingtone(null, "Default alarm sound");
    applyAlarmRingtone(null);
  }, [setRingtone]);

  return (
    <>
      <SectionHeader title="Reminders" />
      <RemindersCheck />
      {Platform.OS === "android" ? (
        <Card className="mt-3 p-0 overflow-hidden">
          {NativeAlarm?.setKeepAlive ? (
            <MenuRow
              icon="zap"
              label="Run in background"
              subtitle="Starts with your phone so reminders and alarms ring even when Seishin is closed"
              right={<Toggle value={keepAlive} onValueChange={toggleKeepAlive} />}
            />
          ) : null}
          <MenuRow
            icon="music"
            label="Alarm Ringtone"
            subtitle={ringtoneName}
            onPress={choose}
            right={ringtoneUri ? (
              <TouchableOpacity onPress={reset} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} className="px-2.5 py-1 rounded-lg bg-ink-100">
                <Text className="text-xs text-ink-500 font-medium">Reset</Text>
              </TouchableOpacity>
            ) : undefined}
          />
        </Card>
      ) : null}
    </>
  );
}
