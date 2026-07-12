import { useState } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Alert } from "react-native";
import { Stack, router } from "expo-router";
import { useMusicStore } from "@/stores/music-store";
import { downloadSpotifyUrl, isValidSpotifyUrl, DownloadProgress } from "@/services/music-download";
import Feather from "@expo/vector-icons/Feather";

interface DownloadTask {
  id: string;
  title: string;
  artist: string;
  progress: number;
  status: "queued" | "fetching" | "downloading" | "completed" | "error";
  coverUri?: string;
  trackProgress: DownloadProgress[];
}

export default function MusicDownloadScreen() {
  const [url, setUrl] = useState("");
  const [tasks, setTasks] = useState<DownloadTask[]>([]);
  const [isDownloading, setIsDownloading] = useState(false);
  const loadAlbums = useMusicStore((s) => s.loadAlbums);

  function addDownload() {
    if (!url.trim()) return;
    if (!isValidSpotifyUrl(url.trim())) {
      Alert.alert("Invalid URL", "Please enter a valid Spotify playlist or album URL");
      return;
    }

    const task: DownloadTask = {
      id: `dl-${Date.now()}`,
      title: "Preparing...",
      artist: "",
      progress: 0,
      status: "queued",
      trackProgress: [],
    };
    setTasks((prev) => [task, ...prev]);
    setUrl("");
    startDownload(task.id, url.trim());
  }

  async function startDownload(taskId: string, spotifyUrl: string) {
    setIsDownloading(true);
    setTasks((prev) => prev.map((t) => t.id === taskId ? { ...t, status: "fetching" as const } : t));

    try {
      const result = await downloadSpotifyUrl(spotifyUrl, {
        onProgress: (progress) => {
          setTasks((prev) =>
            prev.map((t) => {
              if (t.id !== taskId) return t;
              const trackProgress = [...t.trackProgress];
              const existingIndex = trackProgress.findIndex((tp) => tp.trackIndex === progress.trackIndex);
              if (existingIndex >= 0) {
                trackProgress[existingIndex] = progress;
              } else {
                trackProgress.push(progress);
              }
              const completedTracks = trackProgress.filter((tp) => tp.status === "completed").length;
              const totalProgress = progress.totalTracks > 0
                ? (completedTracks / progress.totalTracks) * 100
                : 0;
              return {
                ...t,
                title: progress.trackTitle || t.title,
                progress: Math.round(totalProgress),
                status: progress.status === "error" ? "error" as const : "downloading" as const,
                trackProgress,
              };
            })
          );
        },
        onTrackComplete: (track) => {
        },
        onError: (error, trackTitle) => {
          setTasks((prev) =>
            prev.map((t) =>
              t.id === taskId ? { ...t, status: "error" as const, artist: `Error: ${trackTitle}` } : t
            )
          );
        },
      });

      const album = useMusicStore.getState().getAlbum(result.albumId);
      if (album) {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  status: "completed" as const,
                  progress: 100,
                  title: album.title,
                  artist: `${album.artist} · ${result.trackCount}/${result.sourceTrackCount} playable previews saved${
                    result.unavailableTrackCount ? ` · ${result.unavailableTrackCount} unavailable` : ""
                  }`,
                }
              : t
          )
        );
        loadAlbums();
      }
    } catch (error) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId ? { ...t, status: "error" as const, artist: `Error: ${(error as Error).message}` } : t
        )
      );
    } finally {
      setIsDownloading(false);
    }
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

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
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
              editable={!isDownloading}
            />
          </View>
          <TouchableOpacity
            onPress={addDownload}
            disabled={!url.trim() || isDownloading}
            className={`h-12 w-12 rounded-xl items-center justify-center ${url.trim() && !isDownloading ? "bg-black" : "bg-ink-200"}`}
          >
            <Feather name={isDownloading ? "loader" : "download"} size={18} color="#ffffff" />
          </TouchableOpacity>
        </View>
        <Text className="text-xs text-ink-400 mt-2 ml-1">
          Spotify only supplies the previews it authorizes. Saved previews appear in the Music tab and can be played offline.
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

            {item.status === "downloading" && item.trackProgress.length > 0 && (
              <View className="mt-3 space-y-2">
                {item.trackProgress.slice(-3).map((tp) => (
                  <View key={tp.trackIndex} className="flex-row items-center gap-2">
                    <View className="flex-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
                      <View className="h-full bg-black rounded-full" style={{ width: `${tp.progress}%` }} />
                    </View>
                    <Text className="text-xs text-ink-400 w-12 text-right">{Math.round(tp.progress)}%</Text>
                    <Text className="text-[10px] text-ink-500 w-32 truncate">{tp.trackTitle}</Text>
                  </View>
                ))}
                <View className="flex-row items-center justify-between">
                  <Text className="text-xs text-ink-400">Overall: {item.progress}%</Text>
                  <Text className="text-xs text-ink-400">
                    {item.trackProgress.filter((tp) => tp.status === "completed").length} / {item.trackProgress[0]?.totalTracks ?? 0} tracks
                  </Text>
                </View>
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
