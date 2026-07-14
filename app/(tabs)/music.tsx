import { useState, useEffect, useMemo } from "react";
import { View, Text, TouchableOpacity, FlatList, Image, Alert, TextInput, SectionList } from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useMusicStore, Track, DownloadItem, Album } from "@/stores/music-store";
import { importLocalAudioFiles } from "@/services/music-import";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { MiniPlayer } from "@/components/MiniPlayer";
import Feather from "@expo/vector-icons/Feather";

type Tab = "songs" | "downloads";

interface AlbumSection {
  album: Album;
  data: Track[];
}

export default function MusicScreen() {
  const { albums, downloads, loadAlbums, setCurrentAlbum, currentAlbum } = useMusicStore();
  const [isImporting, setIsImporting] = useState(false);
  const [tab, setTab] = useState<Tab>("songs");
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

  const albumSections = useMemo(() => {
    const q = search.toLowerCase().trim();
    return albums
      .map((a) => ({
        album: a,
        data: q
          ? a.tracks.filter((t) =>
              t.title.toLowerCase().includes(q) || t.artist.toLowerCase().includes(q)
            )
          : a.tracks,
      }))
      .filter((s) => s.data.length > 0)
      .sort((a, b) => new Date(b.album.downloadedAt).getTime() - new Date(a.album.downloadedAt).getTime());
  }, [albums, search]);

  function formatDuration(seconds: number): string {
    if (!seconds) return "";
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

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

  function renderAlbumHeader(album: Album) {
    return (
      <View className="flex-row items-center gap-3 pt-4 pb-2 px-4">
        <Image
          source={{ uri: album.coverUri || "" }}
          className="w-14 h-14 rounded-xl bg-ink-100"
          resizeMode="cover"
        />
        <View className="flex-1 min-w-0">
          <Text className="text-base font-semibold text-black" numberOfLines={1}>{album.title}</Text>
          <Text className="text-sm text-ink-400" numberOfLines={1}>{album.artist}</Text>
          <Text className="text-xs text-ink-300 mt-0.5">{album.tracks.length} tracks</Text>
        </View>
        <TouchableOpacity
          onPress={() => { setCurrentAlbum(album, 0); router.push("/music-player"); }}
          className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center"
        >
          <Feather name="play" size={16} color="#000" />
        </TouchableOpacity>
      </View>
    );
  }

  function renderTrackItem(track: Track, album: Album, index: number) {
    return (
      <TouchableOpacity
        key={track.id}
        activeOpacity={0.5}
        className="flex-row items-center gap-3 px-4 py-2.5"
        onPress={() => {
          setCurrentAlbum(album, index);
          router.push("/music-player");
        }}
      >
        <Text className="text-xs text-ink-300 w-5 text-right font-mono">{index + 1}</Text>
        <Image
          source={{ uri: track.coverUri || album.coverUri || "" }}
          className="w-10 h-10 rounded-md bg-ink-100"
          resizeMode="cover"
        />
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-medium text-black" numberOfLines={1}>{track.title}</Text>
          <Text className="text-xs text-ink-400" numberOfLines={1}>{track.artist}</Text>
        </View>
        <Text className="text-xs text-ink-300">{formatDuration(track.duration)}</Text>
      </TouchableOpacity>
    );
  }

  function renderDownloadItem(item: DownloadItem) {
    const isDl = item.status === "downloading";
    const isDone = item.status === "completed";
    const isErr = item.status === "error";
    return (
      <View key={item.id} className="flex-row items-center gap-3 px-4 py-3 border-b border-ink-50">
        <View className="w-10 h-10 rounded-lg bg-ink-100 items-center justify-center">
          {isDone ? <Feather name="check-circle" size={20} color="#2fbf71" />
          : isErr ? <Feather name="alert-circle" size={20} color="#ef4444" />
          : <Feather name="loader" size={20} color="#999" />}
        </View>
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-medium text-black" numberOfLines={1}>{item.title}</Text>
          {item.artist ? <Text className="text-xs text-ink-400">{item.artist}</Text> : null}
          {isDl && (
            <View className="mt-1.5 h-1 bg-ink-100 rounded-full overflow-hidden">
              <View className="h-full bg-black rounded-full" style={{ width: `${Math.max(2, Math.round(item.progress * 100))}%` }} />
            </View>
          )}
          {isDl && <Text className="text-[10px] text-ink-300 mt-0.5">{Math.round(item.progress * 100)}%</Text>}
          {isErr && <Text className="text-[10px] text-red-500 mt-0.5">{item.error || "Download failed"}</Text>}
        </View>
      </View>
    );
  }

  const sections = tab === "songs" ? albumSections.map((s) => ({
    title: s.album.title,
    album: s.album,
    data: s.data,
  })) : [];

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-3 pb-2" style={{ paddingTop: 12 }}>
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className="text-2xl font-bold tracking-tight text-black">Music</Text>
            <Text className="text-sm text-ink-400 mt-0.5">
              {tab === "songs"
                ? `${albums.length} album${albums.length !== 1 ? "s" : ""} · ${albums.reduce((s, a) => s + a.tracks.length, 0)} songs`
                : `${downloads.length} download${downloads.length !== 1 ? "s" : ""}`}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={importMusic}
              disabled={isImporting}
              className="h-9 px-3.5 bg-ink-100 rounded-full flex-row items-center gap-1.5"
            >
              <Feather name="upload" size={14} color="#000" />
              <Text className="text-xs font-semibold text-black">{isImporting ? "Adding" : "Import"}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push("/music-download")}
              className="w-9 h-9 bg-black rounded-full items-center justify-center"
              accessibilityLabel="Download music"
            >
              <Feather name="download" size={16} color="#ffffff" />
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

      {tab === "downloads" && (
        <View className="mx-4 mb-3">
          <View className="flex-row items-center h-9 bg-ink-50 rounded-xl px-3 gap-2">
            <Feather name="search" size={14} color="#999" />
            <TextInput
              className="flex-1 text-sm text-black"
              placeholder="Filter downloads..."
              placeholderTextColor="#999"
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch("")}>
                <Feather name="x-circle" size={14} color="#ccc" />
              </TouchableOpacity>
            )}
          </View>
        </View>
      )}

      {tab === "songs" ? (
        albumSections.length > 0 ? (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            contentContainerClassName="pb-36"
            showsVerticalScrollIndicator={false}
            renderSectionHeader={({ section }) => renderAlbumHeader(section.album)}
            renderItem={({ item, section, index }) => renderTrackItem(item, section.album, index)}
            SectionSeparatorComponent={() => <View className="h-3" />}
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
            contentContainerClassName="pb-36"
            showsVerticalScrollIndicator={false}
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
