import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { Toggle } from "@/components/ui/Toggle";
import {
  disconnectCalendars, ensureCalendarPermission, listDeviceCalendars, readSyncState,
  suggestDefaults, syncCalendars, writeSyncState, type CalendarSyncState, type DeviceCalendar,
} from "@/services/calendar-sync";

function ago(iso: string | null): string {
  if (!iso) return "never";
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} h ago` : new Date(iso).toLocaleDateString();
}

/** Two-way sync with Google / Outlook / Samsung calendars via the phone's calendar provider. */
export function CalendarConnector() {
  const C = useColors();
  const [state, setState] = useState<CalendarSyncState>(readSyncState);
  const [cals, setCals] = useState<DeviceCalendar[] | null>(null);
  const [busy, setBusy] = useState(false);

  const loadCals = useCallback(async () => {
    try {
      setCals(await listDeviceCalendars());
    } catch {
      setCals([]);
    }
  }, []);

  useEffect(() => {
    if (state.enabled) loadCals();
  }, [state.enabled, loadCals]);

  const update = (patch: Partial<CalendarSyncState>) => setState(writeSyncState(patch));

  const sync = useCallback(async () => {
    setBusy(true);
    const res = await syncCalendars();
    setBusy(false);
    setState(readSyncState());
    if (res === null && readSyncState().lastError) Alert.alert("Sync didn't finish", readSyncState().lastError ?? "Please try again.");
  }, []);

  const connect = useCallback(async () => {
    setBusy(true);
    if (!(await ensureCalendarPermission())) {
      setBusy(false);
      Alert.alert("Calendar access needed", "Allow calendar access in system settings so Seishin can sync with your Google calendar.");
      return;
    }
    const list = await listDeviceCalendars().catch(() => []);
    setCals(list);
    if (list.length === 0) {
      setBusy(false);
      Alert.alert("No calendars found", "Add your Google account in the phone's Settings → Accounts, turn on Calendar sync, then try again.");
      return;
    }
    setState(writeSyncState({ enabled: true, ...suggestDefaults(list), lastError: null }));
    setBusy(false);
    sync();
  }, [sync]);

  const disconnect = () =>
    Alert.alert("Disconnect calendars?", "Synced events are removed from Seishin. Nothing is deleted from your Google or phone calendars.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: () => { disconnectCalendars(); setState(readSyncState()); } },
    ]);

  const toggleImport = (id: string) =>
    update({ importIds: state.importIds.includes(id) ? state.importIds.filter((x) => x !== id) : [...state.importIds, id] });

  if (!state.enabled) {
    return (
      <View>
        <Text className="text-sm text-ink-600 leading-5">
          See your Google, Outlook or Samsung calendar here, and send Seishin events and task deadlines back — uses the accounts already on your phone, no extra sign-in.
        </Text>
        <TouchableOpacity onPress={connect} disabled={busy} accessibilityRole="button" className="mt-3 h-12 rounded-xl bg-accent flex-row items-center justify-center gap-2">
          {busy ? <ActivityIndicator color={C.onAccent} /> : <Feather name="link" size={16} color={C.onAccent} />}
          <Text className="text-[15px] font-bold text-accent-on">Connect calendars</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const writable = (cals ?? []).filter((c) => c.writable);
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className={`text-[13px] font-medium ${state.lastError ? "text-danger" : "text-ink-600"}`}>
          {state.lastError ? state.lastError : `Synced ${ago(state.lastSync)}`}
        </Text>
        <TouchableOpacity onPress={sync} disabled={busy} accessibilityRole="button" className="h-10 px-4 rounded-full bg-ink-50 flex-row items-center gap-2">
          {busy ? <ActivityIndicator size="small" color={C.black} /> : <Feather name="refresh-cw" size={14} color={C.black} />}
          <Text className="text-[13px] font-semibold text-black">Sync now</Text>
        </TouchableOpacity>
      </View>

      <Text className="text-xs font-bold tracking-wide text-ink-500 mt-5 mb-1">SHOW IN SEISHIN</Text>
      {cals === null ? <ActivityIndicator style={{ marginVertical: 12 }} color={C.ink500} /> : null}
      {(cals ?? []).map((c) => {
        const on = state.importIds.includes(c.id);
        return (
          <TouchableOpacity key={c.id} onPress={() => toggleImport(c.id)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} className="flex-row items-center gap-3 min-h-[48px]">
            <View className="w-5 h-5 rounded-md items-center justify-center" style={{ backgroundColor: on ? c.color : "transparent", borderWidth: 2, borderColor: c.color }}>
              {on ? <Feather name="check" size={12} color="#ffffff" /> : null}
            </View>
            <View className="flex-1">
              <Text className="text-[15px] text-black" numberOfLines={1}>{c.title}</Text>
              <Text className="text-xs text-ink-500" numberOfLines={1}>{c.account}</Text>
            </View>
          </TouchableOpacity>
        );
      })}

      <Text className="text-xs font-bold tracking-wide text-ink-500 mt-5 mb-1">SAVE SEISHIN EVENTS TO</Text>
      {writable.map((c) => {
        const on = state.exportId === c.id;
        return (
          <TouchableOpacity key={c.id} onPress={() => update({ exportId: c.id })} accessibilityRole="radio" accessibilityState={{ selected: on }} className="flex-row items-center gap-3 min-h-[48px]">
            <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${on ? "border-accent" : "border-ink-300"}`}>
              {on ? <View className="w-2.5 h-2.5 rounded-full bg-accent" /> : null}
            </View>
            <View className="flex-1">
              <Text className="text-[15px] text-black" numberOfLines={1}>{c.title}</Text>
              <Text className="text-xs text-ink-500" numberOfLines={1}>{c.account}</Text>
            </View>
          </TouchableOpacity>
        );
      })}
      <TouchableOpacity onPress={() => update({ exportId: null })} accessibilityRole="radio" accessibilityState={{ selected: state.exportId === null }} className="flex-row items-center gap-3 min-h-[48px]">
        <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${state.exportId === null ? "border-accent" : "border-ink-300"}`}>
          {state.exportId === null ? <View className="w-2.5 h-2.5 rounded-full bg-accent" /> : null}
        </View>
        <Text className="text-[15px] text-black">Don't send Seishin events</Text>
      </TouchableOpacity>

      <View className="flex-row items-center justify-between mt-3 min-h-[48px]">
        <View className="flex-1 pr-3">
          <Text className="text-[15px] text-black">Add task deadlines</Text>
          <Text className="text-xs text-ink-500">Shows "Due: …" in your calendar until the task is done</Text>
        </View>
        <Toggle value={state.exportTasks} onValueChange={(v) => update({ exportTasks: v })} />
      </View>

      <TouchableOpacity onPress={disconnect} accessibilityRole="button" className="mt-3 h-11 justify-center">
        <Text className="text-sm font-semibold text-danger">Disconnect</Text>
      </TouchableOpacity>
    </View>
  );
}
