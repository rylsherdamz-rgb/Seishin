import { useCallback, useEffect, useState } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { Toggle } from "@/components/ui/Toggle";
import { Segmented } from "./shared";
import {
  disconnectCalendars, ensureCalendarPermission, listDeviceCalendars, readSyncState,
  suggestDefaults, writeSyncState, type CalendarSyncState, type DeviceCalendar,
} from "@/services/calendar-sync";
import { chosenAccounts, groupCalendarsByAccount, setAccountChosen } from "@/services/calendar-sync-plan";

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
  const [openAccount, setOpenAccount] = useState<string | null>(null);
  const [chooseAccounts, setChooseAccounts] = useState(false);
  const [pickTarget, setPickTarget] = useState(false);

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

  const sync = useCallback(async () => {
    setBusy(true);
    // Calendars + their reminders + widgets, no network connectors.
    const { syncEverything } = await import("@/services/connectors/sync-all");
    await syncEverything("calendar", { local: true });
    setBusy(false);
    const after = readSyncState();
    setState(after);
    if (after.lastError) Alert.alert("Sync didn't finish", after.lastError);
  }, []);

  // Settings changes apply right away instead of at the next background run.
  const update = (patch: Partial<CalendarSyncState>) => {
    setState(writeSyncState(patch));
    sync();
  };

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
      Alert.alert("No calendars found", "Add your Google account in the phone's Settings > Accounts, turn on Calendar sync, then try again.");
      return;
    }
    setState(writeSyncState({ enabled: true, ...suggestDefaults(list), lastError: null }));
    setBusy(false);
    sync();
  }, [sync]);

  const disconnect = () =>
    Alert.alert("Disconnect calendars?", "Synced events are removed from Seishin. Nothing is deleted from your Google or phone calendars.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: () => { disconnectCalendars(); setState(readSyncState()); sync(); } },
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

  const all = cals ?? [];
  const allGroups = groupCalendarsByAccount(all);
  const accounts = chosenAccounts(state.accounts, state.importIds, all);
  const groups = allGroups.filter((g) => accounts.includes(g.account));
  const choosing = chooseAccounts || (cals !== null && accounts.length === 0);
  const pickAccount = (account: string, on: boolean) =>
    update(setAccountChosen({ accounts, importIds: state.importIds, exportId: state.exportId }, all, account, on));
  const target = all.find((c) => c.id === state.exportId);
  const writableGroups = groups
    .map((g) => ({ ...g, calendars: g.calendars.filter((c) => c.writable) }))
    .filter((g) => g.calendars.length > 0);

  return (
    <View>
      <View className="flex-row items-center justify-between">
        <Text className={`flex-1 pr-3 text-[13px] font-medium ${state.lastError ? "text-danger" : "text-ink-600"}`} numberOfLines={2}>
          {state.lastError ? state.lastError : `Synced ${ago(state.lastSync)}`}
        </Text>
        <TouchableOpacity onPress={sync} disabled={busy} accessibilityRole="button" className="h-10 px-4 rounded-full bg-ink-50 flex-row items-center gap-2">
          {busy ? <ActivityIndicator size="small" color={C.black} /> : <Feather name="refresh-cw" size={14} color={C.black} />}
          <Text className="text-[13px] font-semibold text-black">Sync now</Text>
        </TouchableOpacity>
      </View>

      <View className="flex-row items-center justify-between mt-5 mb-1">
        <Text className="text-xs font-bold tracking-wide text-ink-500">ACCOUNTS</Text>
        {cals && accounts.length > 0 ? (
          <TouchableOpacity onPress={() => setChooseAccounts(!chooseAccounts)} accessibilityRole="button" hitSlop={8} className="h-8 justify-center">
            <Text className="text-[13px] font-semibold text-accent">{chooseAccounts ? "Done" : "Choose accounts"}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
      {cals === null ? <ActivityIndicator style={{ marginVertical: 12 }} color={C.ink500} /> : null}

      {choosing ? (
        <View className="rounded-xl bg-ink-50 px-3 py-2 mb-2">
          <Text className="text-xs text-ink-600 mb-1">
            {accounts.length === 0 ? "Pick the accounts whose calendars Seishin should use." : "Seishin only uses the accounts you tick."}
          </Text>
          {allGroups.map((g) => {
            const on = accounts.includes(g.account);
            return (
              <TouchableOpacity key={g.account} onPress={() => pickAccount(g.account, !on)} accessibilityRole="checkbox" accessibilityState={{ checked: on }} className="flex-row items-center gap-3 min-h-[48px]">
                <View className={`w-5 h-5 rounded-md items-center justify-center border-2 ${on ? "bg-accent border-accent" : "border-ink-300"}`}>
                  {on ? <Feather name="check" size={12} color={C.onAccent} /> : null}
                </View>
                <View className="flex-1">
                  <Text className="text-[15px] text-black" numberOfLines={1}>{g.account}</Text>
                  <Text className="text-xs text-ink-500">{g.calendars.length} calendar{g.calendars.length === 1 ? "" : "s"}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {groups.map((g) => {
        const on = g.calendars.filter((c) => state.importIds.includes(c.id)).length;
        const open = openAccount === g.account;
        return (
          <View key={g.account} className="border-t border-ink-75">
            <TouchableOpacity
              onPress={() => setOpenAccount(open ? null : g.account)}
              accessibilityRole="button"
              accessibilityState={{ expanded: open }}
              className="flex-row items-center min-h-[52px]"
            >
              <View className="flex-1 pr-2">
                <Text className="text-[15px] font-semibold text-black" numberOfLines={1}>{g.account}</Text>
                <Text className="text-xs text-ink-500">{on} of {g.calendars.length} calendar{g.calendars.length === 1 ? "" : "s"} shown</Text>
              </View>
              <Feather name={open ? "chevron-up" : "chevron-down"} size={18} color={C.ink500} />
            </TouchableOpacity>
            {open
              ? g.calendars.map((c) => {
                  const checked = state.importIds.includes(c.id);
                  return (
                    <TouchableOpacity key={c.id} onPress={() => toggleImport(c.id)} accessibilityRole="checkbox" accessibilityState={{ checked }} className="flex-row items-center gap-3 min-h-[44px] pl-2">
                      <View className="w-5 h-5 rounded-md items-center justify-center" style={{ backgroundColor: checked ? c.color : "transparent", borderWidth: 2, borderColor: c.color }}>
                        {checked ? <Feather name="check" size={12} color="#ffffff" /> : null}
                      </View>
                      <Text className="flex-1 text-[15px] text-black" numberOfLines={1}>{calendarName(c)}</Text>
                    </TouchableOpacity>
                  );
                })
              : null}
          </View>
        );
      })}

      <Text className="text-xs font-bold tracking-wide text-ink-500 mt-5 mb-2">SAVE SEISHIN EVENTS TO</Text>
      <TouchableOpacity
        onPress={() => setPickTarget(!pickTarget)}
        accessibilityRole="button"
        accessibilityState={{ expanded: pickTarget }}
        className="flex-row items-center gap-3 min-h-[52px] px-3 rounded-xl bg-ink-50"
      >
        <View className="w-3 h-3 rounded-full" style={{ backgroundColor: target?.color ?? C.ink300 }} />
        <View className="flex-1">
          <Text className="text-[15px] font-semibold text-black" numberOfLines={1}>{target ? calendarName(target) : "Don't send Seishin events"}</Text>
          {target ? <Text className="text-xs text-ink-500" numberOfLines={1}>{target.account}</Text> : null}
        </View>
        <Feather name={pickTarget ? "chevron-up" : "chevron-down"} size={18} color={C.ink500} />
      </TouchableOpacity>
      {pickTarget ? (
        <View className="mt-1">
          {writableGroups.map((g) => (
            <View key={g.account}>
              <Text className="text-xs font-semibold text-ink-500 mt-3 mb-0.5" numberOfLines={1}>{g.account}</Text>
              {g.calendars.map((c) => (
                <TargetRow key={c.id} label={calendarName(c)} color={c.color} on={state.exportId === c.id} onPress={() => { setPickTarget(false); update({ exportId: c.id }); }} />
              ))}
            </View>
          ))}
          <View className="mt-2">
            <TargetRow label="Don't send Seishin events" on={state.exportId === null} onPress={() => { setPickTarget(false); update({ exportId: null }); }} />
          </View>
        </View>
      ) : null}

      <Segmented
        label="Remind me about synced events"
        value={state.defaultReminder}
        onChange={(v) => update({ defaultReminder: v })}
        options={[{ value: 0, label: "Their own" }, { value: 10, label: "10 min" }, { value: 30, label: "30 min" }, { value: 60, label: "1 h" }]}
      />
      <Text className="text-xs text-ink-500 mt-1.5">Events with their own Google reminder keep it.</Text>

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

/** A Google primary calendar is titled with the account's email; name it plainly. */
function calendarName(c: DeviceCalendar): string {
  return c.title === c.account ? "Main calendar" : c.title;
}

function TargetRow({ label, color, on, onPress }: { label: string; color?: string; on: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="radio" accessibilityState={{ selected: on }} className="flex-row items-center gap-3 min-h-[44px]">
      <View className={`w-5 h-5 rounded-full border-2 items-center justify-center ${on ? "border-accent" : "border-ink-300"}`}>
        {on ? <View className="w-2.5 h-2.5 rounded-full bg-accent" /> : null}
      </View>
      {color ? <View className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} /> : null}
      <Text className="flex-1 text-[15px] text-black" numberOfLines={1}>{label}</Text>
    </TouchableOpacity>
  );
}
