import { useState } from "react";
import { View, Text, TouchableOpacity, Alert, ActivityIndicator } from "react-native";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { Toggle } from "@/components/ui/Toggle";
import { feedsState, type Feed } from "@/services/connectors/state";
import { addFeed, fetchFeed, normalizeFeedUrl, removeFeed, syncFeed } from "@/services/connectors/feeds";
import { ago, Field, PrimaryButton } from "./shared";

const WHERE = [
  ["Canvas", "Calendar → Calendar Feed (bottom right)"],
  ["Google Classroom", "Google Calendar → class calendar settings → Secret address in iCal format"],
  ["Moodle", "Calendar → Export calendar → Get calendar URL"],
  ["Outlook", "Settings → Calendar → Shared calendars → Publish → ICS link"],
];

/** Subscribe to any .ics calendar link — school LMS, Classroom, Outlook, sports, holidays. */
export function FeedsConnector() {
  const C = useColors();
  const [feeds, setFeeds] = useState<Feed[]>(feedsState.get);
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [showHelp, setShowHelp] = useState(false);

  const refresh = () => setFeeds(feedsState.get());

  const add = async () => {
    const clean = normalizeFeedUrl(url);
    if (!clean) { Alert.alert("Check the link", "Paste an https:// or webcal:// calendar link (it usually ends in .ics)."); return; }
    setBusy("new");
    try {
      const events = await fetchFeed(clean);
      const feed = addFeed(name || "Calendar feed", clean);
      await syncFeed(feed);
      setName("");
      setUrl("");
      refresh();
      Alert.alert("Subscribed", `${events.length} item${events.length === 1 ? "" : "s"} found. Deadlines become tasks with reminders.`);
    } catch (e) {
      Alert.alert("Couldn't add feed", e instanceof Error ? e.message : "Check the link and try again.");
    } finally {
      setBusy(null);
    }
  };

  const syncOne = async (f: Feed) => {
    setBusy(f.id);
    await syncFeed(f);
    refresh();
    setBusy(null);
  };

  const remove = (f: Feed) =>
    Alert.alert(`Remove "${f.name}"?`, "Its events are removed from Seishin and its deadline tasks are marked done.", [
      { text: "Cancel", style: "cancel" },
      { text: "Remove", style: "destructive", onPress: () => { removeFeed(f.id); refresh(); } },
    ]);

  return (
    <View>
      {feeds.map((f) => (
        <View key={f.id} className="py-3 border-b border-ink-75">
          <View className="flex-row items-center gap-2">
            <Feather name="rss" size={15} color={C.ink600} />
            <Text className="flex-1 text-[15px] font-semibold text-black" numberOfLines={1}>{f.name}</Text>
            <TouchableOpacity onPress={() => syncOne(f)} accessibilityRole="button" accessibilityLabel={`Refresh ${f.name}`} className="w-10 h-10 items-center justify-center">
              {busy === f.id ? <ActivityIndicator size="small" color={C.black} /> : <Feather name="refresh-cw" size={15} color={C.ink700} />}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => remove(f)} accessibilityRole="button" accessibilityLabel={`Remove ${f.name}`} className="w-10 h-10 items-center justify-center">
              <Feather name="trash-2" size={15} color={C.ink700} />
            </TouchableOpacity>
          </View>
          <Text className={`text-xs ml-6 ${f.lastError ? "text-danger" : "text-ink-500"}`}>{f.lastError ?? `Updated ${ago(f.lastSync)}`}</Text>
          <View className="flex-row items-center justify-between ml-6 mt-2">
            <Text className="text-[13px] text-ink-700 flex-1">Turn deadlines into tasks with reminders</Text>
            <Toggle size="small" value={f.mode === "auto"} onValueChange={(v) => { feedsState.patch(f.id, { mode: v ? "auto" : "events" }); refresh(); }} />
          </View>
        </View>
      ))}

      <Field label="Name" value={name} onChange={setName} placeholder="e.g. Canvas, Classroom, Holidays" />
      <Field label="Calendar link (.ics)" value={url} onChange={setUrl} placeholder="https://… or webcal://…" />
      <PrimaryButton label="Subscribe" icon="plus" onPress={add} busy={busy === "new"} disabled={url.trim().length < 12} />

      <TouchableOpacity onPress={() => setShowHelp((v) => !v)} accessibilityRole="button" className="mt-3 h-10 flex-row items-center gap-1.5">
        <Feather name={showHelp ? "chevron-up" : "help-circle"} size={14} color={C.ink600} />
        <Text className="text-[13px] font-semibold text-ink-700">Where do I find the link?</Text>
      </TouchableOpacity>
      {showHelp ? (
        <View className="gap-2">
          {WHERE.map(([app, how]) => (
            <Text key={app} className="text-[13px] text-ink-700 leading-[19px]"><Text className="font-bold text-black">{app}: </Text>{how}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}
