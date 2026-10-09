import { useState } from "react";
import { View, Text, Alert } from "react-native";
import { todoistState, type TodoistState } from "@/services/connectors/state";
import { setToken, deleteToken } from "@/services/connectors/secrets";
import { syncTodoist, verifyTodoist } from "@/services/connectors/todoist";
import { DangerLink, Field, PrimaryButton, ReminderChips, StatusLine, Steps } from "./shared";

/** Two-way Todoist tasks via a personal API token. */
export function TodoistConnector() {
  const [state, setState] = useState<TodoistState>(todoistState.get);
  const [token, setTokenInput] = useState("");
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      const count = await verifyTodoist(token.trim());
      if (!(await setToken("todoist", token))) throw new Error("Couldn't store the token securely on this phone");
      setState(todoistState.set({ enabled: true, lastError: null }));
      setTokenInput("");
      await syncTodoist();
      setState(todoistState.get());
      Alert.alert("Todoist connected", `${count} open task${count === 1 ? "" : "s"} found and synced.`);
    } catch (e) {
      Alert.alert("Couldn't connect", e instanceof Error ? e.message : "Check the token and try again.");
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    await syncTodoist();
    setState(todoistState.get());
    setBusy(false);
  };

  const disconnect = () =>
    Alert.alert("Disconnect Todoist?", "Imported tasks stay in Seishin but stop syncing. Nothing is deleted in Todoist.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: async () => { await deleteToken("todoist"); setState(todoistState.set({ enabled: false })); } },
    ]);

  if (!state.enabled) {
    return (
      <View>
        <Steps steps={["In Todoist open Settings → Integrations → Developer.", "Copy your API token and paste it below."]} />
        <Field label="API token" value={token} onChange={setTokenInput} placeholder="Paste token" secret />
        <PrimaryButton label="Connect Todoist" onPress={connect} busy={busy} disabled={token.trim().length < 20} />
        <Text className="text-xs text-ink-500 mt-2">Stored encrypted on this phone. Tasks with due dates get Seishin reminders; finishing a task here completes it in Todoist.</Text>
      </View>
    );
  }
  return (
    <View>
      <StatusLine lastSync={state.lastSync} lastError={state.lastError} busy={busy} onSync={sync} />
      <ReminderChips value={state.reminder} onChange={(reminder) => setState(todoistState.set({ reminder }))} />
      <DangerLink label="Disconnect" onPress={disconnect} />
    </View>
  );
}
