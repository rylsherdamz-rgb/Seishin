import { useMemo, useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { Stack, router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Feather from "@expo/vector-icons/Feather";
import { useColors } from "@/theme/ThemeProvider";
import { useSettingsStore } from "@/stores/settings-store";
import { CalendarConnector } from "@/components/connectors/CalendarConnector";
import { TodoistConnector } from "@/components/connectors/TodoistConnector";
import { NotionConnector } from "@/components/connectors/NotionConnector";
import { FeedsConnector } from "@/components/connectors/FeedsConnector";
import { AutoSyncCard } from "@/components/connectors/AutoSyncCard";
import { readSyncState } from "@/services/calendar-sync";
import { feedsState, notionState, todoistState } from "@/services/connectors/state";

type IconName = React.ComponentProps<typeof Feather>["name"];

/** Everything Seishin can pull your life in from, in one place. */
export default function ConnectorsScreen() {
  const C = useColors();
  const insets = useSafeAreaInsets();
  const nimKey = useSettingsStore((s) => s.apiKeys.nim);
  const modelPath = useSettingsStore((s) => s.modelPath);
  // One connector open at a time keeps the page short; collapsed rows show status.
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (id: string) => setOpen((o) => (o === id ? null : id));
  // Re-read on collapse so statuses reflect a connect/disconnect made inside.
  const status = useMemo(() => {
    const cal = readSyncState();
    const feeds = feedsState.get().length;
    return {
      calendar: !cal.enabled ? null
        : cal.accounts ? (cal.accounts.length ? `${cal.accounts.length} account${cal.accounts.length === 1 ? "" : "s"}` : "Choose accounts")
        : `Connected · ${cal.importIds.length} calendar${cal.importIds.length === 1 ? "" : "s"}`,
      feeds: feeds ? `${feeds} subscribed` : null,
      todoist: todoistState.get().enabled ? "Connected" : null,
      notion: notionState.get().enabled ? "Connected" : null,
    };
  }, [open]);

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center h-14 px-1">
        <TouchableOpacity onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back" className="w-12 h-12 items-center justify-center">
          <Feather name="arrow-left" size={22} color={C.ink800} />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-black">Connectors</Text>
      </View>

      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 4, paddingBottom: insets.bottom + 24, gap: 12 }}>
        <Text className="text-sm text-ink-600 px-1 leading-5">
          Syncs straight between this phone and each service. No Seishin server.
        </Text>

        <AutoSyncCard />

        <Section title="Calendars" />
        <Card id="calendar" open={open} onToggle={toggle} icon="calendar" title="Phone calendars" subtitle={status.calendar ?? "Google, Outlook, Samsung"} ok={!!status.calendar}>
          <CalendarConnector />
        </Card>
        <Card id="feeds" open={open} onToggle={toggle} icon="rss" title="School calendar links" subtitle={status.feeds ?? "Canvas, Classroom, Moodle, any .ics"} ok={!!status.feeds}>
          <FeedsConnector />
        </Card>

        <Section title="Tasks" />
        <Card id="todoist" open={open} onToggle={toggle} icon="check-circle" title="Todoist" subtitle={status.todoist ?? "Not connected"} ok={!!status.todoist}>
          <TodoistConnector />
        </Card>
        <Card id="notion" open={open} onToggle={toggle} icon="database" title="Notion" subtitle={status.notion ?? "Not connected"} ok={!!status.notion}>
          <NotionConnector />
        </Card>

        <Section title="Capture" />
        <View className="rounded-[20px] border border-ink-100 p-4">
          <Text className="text-base font-bold text-black">Photos & files</Text>
          <Text className="text-xs text-ink-500">Assignments, notices, PDFs. Seishin finds what's due.</Text>
          <View className="flex-row gap-2">
            <Action icon="camera" label="Camera" onPress={() => router.push({ pathname: "/capture", params: { source: "camera" } })} flex />
            <Action icon="image" label="Photos" onPress={() => router.push({ pathname: "/capture", params: { source: "photos" } })} flex />
            <Action icon="folder" label="Files" onPress={() => router.push({ pathname: "/capture", params: { source: "files" } })} flex />
          </View>
        </View>

        <Card
          id="ai"
          open={open}
          onToggle={toggle}
          icon="zap"
          title="AI reading"
          subtitle={nimKey ? "Cloud model connected" : modelPath ? "On-device model" : "Offline rules only"}
          ok={!!(nimKey || modelPath)}
        >
          <Text className="text-sm text-ink-600 leading-5">
            Smart capture always works offline. Adding an NVIDIA NIM key or an on-device model makes it better at spotting questions and deadlines.
          </Text>
          <Action icon="sliders" label="AI settings" onPress={() => router.push("/settings")} />
        </Card>
      </ScrollView>
    </View>
  );
}

function Section({ title }: { title: string }) {
  return <Text className="text-xs font-bold tracking-widest text-ink-500 px-1 mt-3">{title.toUpperCase()}</Text>;
}

function Card({ id, open, onToggle, icon, title, subtitle, ok, children }: {
  id: string; open: string | null; onToggle: (id: string) => void;
  icon: IconName; title: string; subtitle: string; ok?: boolean; children: React.ReactNode;
}) {
  const C = useColors();
  const expanded = open === id;
  return (
    <View className="rounded-[20px] border border-ink-100">
      <TouchableOpacity
        onPress={() => onToggle(id)}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        className="flex-row items-center gap-3 p-4"
      >
        <View className="w-11 h-11 rounded-2xl bg-ink-50 items-center justify-center">
          <Feather name={icon} size={20} color={C.black} />
        </View>
        <View className="flex-1">
          <Text className="text-base font-bold text-black">{title}</Text>
          <View className="flex-row items-center gap-1.5">
            {ok !== undefined ? <View className={`w-1.5 h-1.5 rounded-full ${ok ? "bg-success" : "bg-ink-300"}`} /> : null}
            <Text className="flex-1 text-xs text-ink-500" numberOfLines={1}>{subtitle}</Text>
          </View>
        </View>
        <Feather name={expanded ? "chevron-up" : "chevron-down"} size={20} color={C.ink500} />
      </TouchableOpacity>
      {expanded ? <View className="px-4 pb-4">{children}</View> : null}
    </View>
  );
}

function Action({ icon, label, onPress, flex }: { icon: IconName; label: string; onPress: () => void; flex?: boolean }) {
  const C = useColors();
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      className={`mt-3 h-11 rounded-xl bg-ink-50 flex-row items-center justify-center gap-2 px-3 ${flex ? "flex-1" : ""}`}
    >
      <Feather name={icon} size={15} color={C.black} />
      <Text className="text-[13px] font-semibold text-black">{label}</Text>
    </TouchableOpacity>
  );
}
