import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList, Image, Alert } from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useMusicStore, Track, DownloadItem } from "@/stores/music-store";
import { importLocalAudioFiles } from "@/services/music-import";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MiniPlayer } from "@/components/MiniPlayer";
import Feather from "@expo/vector-icons/Feather";

type Tab = "songs" | "downloads";

export default function MusicScreen() {
  const { albums, downloads, loadAlbums, setCurrentAlbum, currentAlbum } = useMusicStore();
  const [isImporting, setIsImporting] = useState(false);
  const [tab, setTab] = useState<Tab>("songs");

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  const allTracks: Track[] = albums.flatMap((a) =>
    a.tracks.map((t) => ({ ...t, album: a.title }))
  );

  const importMusic = async () => {
    try {
      setIsImporting(true);
      const result = await DocumentPicker.getDocumentAsync({
        type: "audio/*",
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const album = await importLocalAudioFiles(result.assets);
      loadAlbums();
      setCurrentAlbum(album);
      router.push("/music-player");
    } catch (error) {
      Alert.alert("Couldn't import music", error instanceof Error ? error.message : "Please choose a supported audio file.");
    } finally {
      setIsImporting(false);
    }
  };

  function formatDuration(seconds: number): string {
    if (!seconds) return "";
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function renderTrackItem(track: Track) {
    return (
      <TouchableOpacity
        key={track.id}
        activeOpacity={0.7}
        className="flex-row items-center gap-3 py-3 border-b border-ink-50"
        onPress={() => {
          const a = albums.find((al) => al.tracks.some((t) => t.id === track.id));
          if (a) { setCurrentAlbum(a, a.tracks.findIndex((t) => t.id === track.id)); router.push("/music-player"); }
        }}
      >
        {track.coverUri ? (
          <Image source={{ uri: track.coverUri }} className="w-12 h-12 rounded-lg bg-ink-100" />
        ) : (
          <View className="w-12 h-12 rounded-lg bg-ink-100 items-center justify-center">
            <Feather name="music" size={18} color="#ccc" />
          </View>
        )}
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-medium text-black" numberOfLines={1}>{track.title}</Text>
          <Text className="text-xs text-ink-400" numberOfLines={1}>{track.artist}</Text>
          <Text className="text-[10px] text-ink-300 mt-0.5">{track.album} · {formatDuration(track.duration)}</Text>
        </View>
        <Feather name="chevron-right" size={16} color="#ccc" />
      </TouchableOpacity>
    );
  }

  function renderDownloadItem(item: DownloadItem) {
    const isDl = item.status === "downloading";
    const isDone = item.status === "completed";
    const isErr = item.status === "error";
    return (
      <View key={item.id} className="flex-row items-center gap-3 py-3 border-b border-ink-50">
        <View className="w-12 h-12 rounded-lg bg-ink-100 items-center justify-center">
          {isDone ? <Feather name="check-circle" size={22} color="#2fbf71" />
          : isErr ? <Feather name="alert-circle" size={22} color="#ef4444" />
          : <Feather name="loader" size={22} color="#999" />}
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-medium text-black" numberOfLines={1}>{item.title}</Text>
          <Text className="text-xs text-ink-400">{item.artist}</Text>
          {isDl && (
            <View className="mt-1 h-1.5 bg-ink-100 rounded-full overflow-hidden">
              <View className="h-full bg-black rounded-full" style={{ width: `${Math.round(item.progress * 100)}%` }} />
            </View>
          )}
          {isErr && <Text className="text-[10px] text-red-500 mt-0.5">{item.error || "Download failed"}</Text>}
          {isDl && <Text className="text-[10px] text-ink-300 mt-0.5">{Math.round(item.progress * 100)}%</Text>}
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center justify-between mb-1">
          <View>
            <Text className="text-2xl font-semibold tracking-tightest text-black">Music</Text>
            <Text className="text-sm text-ink-500 mt-0.5">
              {tab === "songs"
                ? `${allTracks.length} song${allTracks.length === 1 ? "" : "s"}`
                : `${downloads.length} download${downloads.length === 1 ? "" : "s"}`}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={importMusic}
              disabled={isImporting}
              className="h-10 px-3.5 bg-ink-100 rounded-full flex-row items-center gap-1.5"
            >
              <Feather name="upload" size={15} color="#000" />
              <Text className="text-xs font-semibold text-black">{isImporting ? "Adding" : "Import"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/music-download")}
              className="w-10 h-10 bg-black rounded-full items-center justify-center"
              accessibilityLabel="Download music"
            >
              <Feather name="download" size={17} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View className="mx-4 mb-3">
        <SegmentedControl
          options={[
            { label: "Songs", value: "songs" },
            { label: "Downloads", value: "downloads" },
          ]}
          value={tab}
          onChange={(v) => setTab(v as Tab)}
        />
      </View>

      {tab === "songs" ? (
        allTracks.length > 0 ? (
          <FlatList
            data={allTracks}
            keyExtractor={(item) => item.id}
            contentContainerClassName={`px-4 ${currentAlbum ? "pb-40" : "pb-24"}`}
            renderItem={({ item }) => renderTrackItem(item)}
          />
        ) : (
          <EmptyState
            icon="music"
            title="No songs yet"
            subtitle="Download music from YouTube or import audio files"
          />
        )
      ) : (
        downloads.length > 0 ? (
          <FlatList
            data={downloads}
            keyExtractor={(item) => item.id}
            contentContainerClassName="px-4 pb-24"
            renderItem={({ item }) => renderDownloadItem(item)}
          />
        ) : (
          <EmptyState
            icon="download"
            title="No downloads"
            subtitle="Tap the download button to find and download music"
          />
        )
      )}

      <MiniPlayer />
    </View>
  );
}
