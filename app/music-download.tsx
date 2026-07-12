import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList } from "react-native";
import { Stack, router } from "expo-router";
import Feather from "@expo/vector-icons/Feather";

interface DownloadTask {
  id: string;
  title: string;
  artist: string;
  progress: number;
  status: "queued" | "fetching" | "downloading" | "completed" | "error";
  coverUri?: string;
}

export default function MusicDownloadScreen() {
  const [url, setUrl] = useState("");
  const [tasks, setTasks] = useState<DownloadTask[]>([]);

  function addDownload() {
    if (!url.trim()) return;
    const task: DownloadTask = {
      id: `dl-${Date.now()}`,
      title: url.trim().split("/").pop() || "Playlist",
      artist: "",
      progress: 0,
      status: "queued",
    };
    setTasks((prev) => [task, ...prev]);
    setUrl("");
    startDownload(task.id);
  }

  async function startDownload(taskId: string) {
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "fetching" as const } : t));
    // TODO: fetch Spotify metadata, search YouTube, download audio + cover
    // Simulate progress for now
    for (let i = 0; i <= 10; i++) {
      await new Promise((r) => setTimeout(r, 300));
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? { ...t, status: "downloading" as const, progress: i * 10 }
            : t
        )
      );
    }
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "completed" as const, progress: 100 } : t));
  }

  const statusIcon: Record<string, React.ComponentProps<typeof Feather>["name"]> = {
    queued: "clock",
    fetching: "search",
    downloading: "download-cloud",
    completed: "check-circle",
    error: "alert-circle",
  };

  const statusColor: Record<string, string> = {
    queued: "#999999",
    fetching: "#000000",
    downloading: "#000000",
    completed: "#2fbf71",
    error: "#ff3b30",
  };

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
            <Feather name="arrow-left" size={16} color="#000" />
          </TouchableOpacity>
          <View>
            <Text className="text-lg font-semibold tracking-tightest text-black">Download Music</Text>
            <Text className="text-xs text-ink-500 mt-0.5">{tasks.filter((t) => t.status === "completed").length} completed</Text>
          </View>
        </View>
      </View>

      <View className="mx-4 mt-2 mb-4">
        <View className="flex-row gap-2 items-center">
          <View className="flex-1 h-12 bg-ink-50 rounded-xl px-4 flex-row items-center gap-2">
            <Feather name="link" size={15} color="#999999" />
            <TextInput
              className="flex-1 text-sm text-black"
              placeholder="Spotify playlist or album URL"
              placeholderTextColor="#999999"
              value={url}
              onChangeText={setUrl}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <TouchableOpacity
            onPress={addDownload}
            disabled={!url.trim()}
            className={`h-12 w-12 rounded-xl items-center justify-center ${url.trim() ? "bg-black" : "bg-ink-200"}`}
          >
            <Feather name="download" size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <Text className="text-xs text-ink-400 mt-2 ml-1">
          Supports Spotify playlists and albums. Songs are found on YouTube and saved offline with metadata.
        </Text>
      </View>

      <FlatList
        data={tasks}
        keyExtractor={(item) => item.id}
        contentContainerClassName="px-4 pb-8"
        renderItem={({ item }) => (
          <View className="bg-white border border-ink-100 rounded-card p-4 mb-2.5">
            <View className="flex-row items-center gap-3">
              <View className="w-10 h-10 bg-ink-100 rounded-xl items-center justify-center">
                <Feather name={item.coverUri ? "image" : "music"} size={18} color="#666" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-black" numberOfLines={1}>{item.title}</Text>
                <Text className="text-xs text-ink-400 mt-0.5">{item.artist || "Unknown artist"}</Text>
              </View>
              <Feather name={statusIcon[item.status]} size={18} color={statusColor[item.status]} />
            </View>

            {item.status === "downloading" && (
              <View className="mt-3">
                <View className="h-1.5 bg-ink-100 rounded-full overflow-hidden">
                  <View className="h-full bg-black rounded-full" style={{ width: `${item.progress}%` }} />
                </View>
                <Text className="text-xs text-ink-400 mt-1 text-right">{item.progress}%</Text>
              </View>
            )}

            <View className="flex-row items-center gap-1 mt-2">
              <View className={`px-2 py-0.5 rounded-full ${
                item.status === "completed" ? "bg-success/10" :
                item.status === "error" ? "bg-danger-soft" : "bg-ink-100"
              }`}>
                <Text className={`text-[10px] font-medium ${
                  item.status === "completed" ? "text-success" :
                  item.status === "error" ? "text-danger" : "text-ink-500"
                }`}>
                  {item.status === "queued" ? "Queued" :
                   item.status === "fetching" ? "Fetching metadata..." :
                   item.status === "downloading" ? "Downloading..." :
                   item.status === "completed" ? "Completed" : "Error"}
                </Text>
              </View>
            </View>
          </View>
        )}
        ListEmptyComponent={
          <View className="items-center justify-center py-24">
            <View className="w-16 h-16 bg-ink-50 border border-ink-100 rounded-full items-center justify-center mb-4">
              <Feather name="download-cloud" size={24} color="#cccccc" />
            </View>
            <Text className="text-base font-medium text-ink-400 text-center">No downloads yet</Text>
            <Text className="text-sm text-ink-200 mt-1 text-center max-w-[260px]">
              Paste a Spotify link above to start downloading
            </Text>
          </View>
        }
      />
    </View>
  );
}
