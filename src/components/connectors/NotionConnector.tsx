import { useState } from "react";
import { View, Text, Alert } from "react-native";
import { notionState, type NotionState } from "@/services/connectors/state";
import { setToken, deleteToken } from "@/services/connectors/secrets";
import { setupNotion, syncNotion } from "@/services/connectors/notion";
import { DangerLink, Field, PrimaryButton, ReminderChips, StatusLine, Steps } from "./shared";

/** A Notion task database ↔ Seishin tasks, via an internal integration secret. */
export function NotionConnector() {
  const [state, setState] = useState<NotionState>(notionState.get);
  const [token, setTokenInput] = useState("");
  const [db, setDb] = useState("");
  const [busy, setBusy] = useState(false);

  const connect = async () => {
    setBusy(true);
    try {
      const s = await setupNotion(token.trim(), db);
      if (!(await setToken("notion", token))) throw new Error("Couldn't store the secret securely on this phone");
      setState(s);
      setTokenInput("");
      await syncNotion();
      setState(notionState.get());
    } catch (e) {
      Alert.alert("Couldn't connect", e instanceof Error ? e.message : "Check the secret and the database link.");
    } finally {
      setBusy(false);
    }
  };

  const sync = async () => {
    setBusy(true);
    await syncNotion();
    setState(notionState.get());
    setBusy(false);
  };

  const disconnect = () =>
    Alert.alert("Disconnect Notion?", "Imported tasks stay in Seishin but stop syncing. Nothing is deleted in Notion.", [
      { text: "Cancel", style: "cancel" },
      { text: "Disconnect", style: "destructive", onPress: async () => { await deleteToken("notion"); setState(notionState.set({ enabled: false })); } },
    ]);

  if (!state.enabled) {
    return (
      <View>
        <Steps
          steps={[
            "Go to notion.so/my-integrations → New integration (internal). Copy its secret.",
            "Open your tasks / homework database → ••• → Connections → add the integration.",
            "Copy the database link (Share → Copy link) and paste both below.",
          ]}
        />
        <Field label="Integration secret" value={token} onChange={setTokenInput} placeholder="ntn_… or secret_…" secret />
        <Field label="Database link" value={db} onChange={setDb} placeholder="https://www.notion.so/…" />
        <PrimaryButton label="Connect Notion" onPress={connect} busy={busy} disabled={token.trim().length < 20 || db.trim().length < 20} />
      </View>
    );
  }
  return (
    <View>
      <StatusLine lastSync={state.lastSync} lastError={state.lastError} busy={busy} onSync={sync} />
      <Text className="text-xs text-ink-500 mt-3">
        Reading columns — title: {state.titleProp ?? "?"} · due: {state.dateProp ?? "none"} · done: {state.doneProp ?? "none"}
        {state.doneType === "status" && state.doneNames.length ? ` (${state.doneNames.join(", ")})` : ""}
      </Text>
      <ReminderChips value={state.reminder} onChange={(reminder) => setState(notionState.set({ reminder }))} />
      <DangerLink label="Disconnect" onPress={disconnect} />
    </View>
  );
}
