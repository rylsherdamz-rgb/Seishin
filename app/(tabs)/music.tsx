import { useState, useEffect, useMemo, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, Image, Alert, TextInput } from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useMusicStore, Track, DownloadItem, Album } from "@/stores/music-store";
import { importLocalAudioFiles } from "@/services/music-import";
import { EmptyState } from "@/components/ui/EmptyState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { PlayerSheet } from "@/components/PlayerSheet";
import { MiniPlayer } from "@/components/MiniPlayer";
import Feather from "@expo/vector-icons/Feather";

type Tab = "songs" | "downloads";
type MusicFilter = "all" | "albums" | "artists";

interface AlbumSection {
  album: Album;
  data: Track[];
}

const formatDuration = (seconds: number): string => {
  if (!seconds) return "";
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
};

export default function MusicScreen() {
  const albums = useMusicStore((s) => s.albums);
  const downloads = useMusicStore((s) => s.downloads);
  const currentAlbum = useMusicStore((s) => s.currentAlbum);
  const loadAlbums = useMusicStore((s) => s.loadAlbums);
  const setCurrentAlbum = useMusicStore((s) => s.setCurrentAlbum);
  const [isImporting, setIsImporting] = useState(false);
  const [tab, setTab] = useState<Tab>("songs");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<MusicFilter>("all");
  const [showPlayer, setShowPlayer] = useState(false);

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

  const allTracks = useMemo(() => {
    const seen = new Set<string>();
    const all: { track: Track; album: Album; idx: number }[] = [];
    albumSections.forEach(s => {
      s.data.forEach((track, i) => {
        const key = `${track.id}-${s.album.id}`;
        if (!seen.has(key)) { seen.add(key); all.push({ track, album: s.album, idx: i }); }
      });
    });
    return all;
  }, [albumSections]);

  const handleSetFilter = useCallback((f: MusicFilter) => setFilter(f), []);

  const handlePlayAlbum = useCallback((album: Album, index?: number) => {
    setCurrentAlbum(album, index ?? 0);
  }, [setCurrentAlbum]);

  const handleImport = useCallback(async () => {
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
      setShowPlayer(true);
    } catch (error) {
      Alert.alert("Couldn't import music", error instanceof Error ? error.message : "Please choose a supported audio file.");
    } finally {
      setIsImporting(false);
    }
  }, [loadAlbums, setCurrentAlbum]);

  const handlePlayFromQueue = useCallback((tracks: Track[], startIndex: number) => {
    const syntheticAlbum: Album = {
      id: "queue-" + Date.now(),
      title: tracks[startIndex]?.album || "Now Playing",
      artist: tracks[startIndex]?.artist || "Unknown",
      coverUri: tracks[startIndex]?.coverUri,
      trackCount: tracks.length,
      totalDuration: tracks.reduce((s, t) => s + t.duration, 0),
      downloadedAt: new Date().toISOString(),
      tracks,
    };
    setCurrentAlbum(syntheticAlbum, startIndex);
  }, [setCurrentAlbum]);

  const handleOpenPlayer = useCallback(() => setShowPlayer(true), []);
  const handleClosePlayer = useCallback(() => setShowPlayer(false), []);

  const handlePlayArtistAlbum = useCallback((album: Album) => {
    setCurrentAlbum(album, 0);
  }, [setCurrentAlbum]);

  const artistsData = useMemo(() => {
    const artistMap = new Map<string, Album[]>();
    albumSections.forEach(s => {
      const existing = artistMap.get(s.album.artist) || [];
      existing.push(s.album);
      artistMap.set(s.album.artist, existing);
    });
    return Array.from(artistMap.entries());
  }, [albumSections]);

  const renderArtistItem = useCallback(({ item: [artist, artistAlbums] }: { item: [string, Album[]] }) => (
    <View className="mb-2">
      <View className="flex-row items-center gap-3 px-4 py-3">
        <View className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center">
          <Feather name="user" size={18} color="#666" />
        </View>
        <Text className="text-base font-semibold text-black">{artist}</Text>
        <Text className="text-xs text-ink-400 ml-auto">{artistAlbums.length} album{artistAlbums.length > 1 ? "s" : ""}</Text>
      </View>
      {artistAlbums.map(album => (
        <TouchableOpacity
          key={album.id}
          onPress={() => handlePlayArtistAlbum(album)}
          className="flex-row items-center gap-3 px-4 py-2 ml-6"
        >
          <Image source={{ uri: album.coverUri || "" }} className="w-10 h-10 rounded-md bg-ink-100" resizeMode="cover" />
          <View className="flex-1 min-w-0">
            <Text className="text-sm text-black" numberOfLines={1}>{album.title}</Text>
            <Text className="text-xs text-ink-400">{album.trackCount} tracks</Text>
          </View>
          <Feather name="chevron-right" size={14} color="#ccc" />
        </TouchableOpacity>
      ))}
    </View>
  ), [handlePlayArtistAlbum]);

  const renderAlbumItem = useCallback(({ item: album }: { item: Album }) => (
    <TouchableOpacity
      onPress={() => handlePlayAlbum(album, 0)}
      className="flex-row items-center gap-3 px-4 py-3 border-b border-ink-50"
    >
      <Image source={{ uri: album.coverUri || "" }} className="w-14 h-14 rounded-xl bg-ink-100" resizeMode="cover" />
      <View className="flex-1 min-w-0">
        <Text className="text-sm font-semibold text-black" numberOfLines={1}>{album.title}</Text>
        <Text className="text-xs text-ink-400" numberOfLines={1}>{album.artist}</Text>
        <Text className="text-xs text-ink-300 mt-0.5">{album.trackCount} tracks · {Math.floor(album.totalDuration / 60)} min</Text>
      </View>
      <Feather name="play" size={16} color="#000" />
    </TouchableOpacity>
  ), [handlePlayAlbum]);

  const renderAllSongItem = useCallback(({ item, index }: { item: { track: Track; album: Album; idx: number }; index: number }) => {
    const queue = allTracks.map(t => t.track);
    return (
      <TouchableOpacity
        key={item.track.id}
        activeOpacity={0.5}
        className="flex-row items-center gap-3 px-4 py-2.5"
        onPress={() => handlePlayFromQueue(queue, index)}
      >
        <Text className="text-xs text-ink-300 w-5 text-right font-mono">{item.idx + 1}</Text>
        <Image
          source={{ uri: item.track.coverUri || item.album.coverUri || "" }}
          className="w-10 h-10 rounded-md bg-ink-100"
          resizeMode="cover"
        />
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-medium text-black" numberOfLines={1}>{item.track.title}</Text>
          <Text className="text-xs text-ink-400" numberOfLines={1}>{item.track.artist}</Text>
        </View>
        <Text className="text-xs text-ink-300">{formatDuration(item.track.duration)}</Text>
      </TouchableOpacity>
    );
  }, [allTracks, handlePlayFromQueue]);

  const renderDownloadItem = useCallback(({ item }: { item: DownloadItem }) => {
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
  }, []);

  const totalSongs = albums.reduce((s, a) => s + a.tracks.length, 0);

  const paddingBottom = currentAlbum && !showPlayer ? 170 : 110;

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center justify-between mb-2">
          <View>
            <Text className="text-2xl font-bold tracking-tight text-black">Music</Text>
            <Text className="text-sm text-ink-400 mt-0.5">
              {tab === "songs"
                ? `${albums.length} album${albums.length !== 1 ? "s" : ""} · ${totalSongs} songs`
                : `${downloads.length} download${downloads.length !== 1 ? "s" : ""}`}
            </Text>
          </View>
          <View className="flex-row items-center gap-2">
            <TouchableOpacity
              onPress={handleImport}
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

      {tab === "songs" && (
        <View className="mx-4 mb-2 flex-row gap-2">
          {(["all", "albums", "artists"] as const).map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => handleSetFilter(f)}
              className={`px-3 py-1.5 rounded-full ${filter === f ? "bg-black" : "bg-ink-100"}`}
            >
              <Text className={`text-xs font-medium ${filter === f ? "text-white" : "text-ink-500"}`}>
                {f === "all" ? "All Songs" : f === "albums" ? "Albums" : "Artists"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

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

      <View className="flex-1">
        {tab === "songs" ? (
          albumSections.length > 0 ? (
            filter === "artists" ? (
              <FlatList
                data={artistsData}
                keyExtractor={([name]) => name}
                contentContainerStyle={{ paddingBottom }}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                maxToRenderPerBatch={10}
                windowSize={10}
                renderItem={renderArtistItem}
              />
            ) : filter === "albums" ? (
              <FlatList
                data={albumSections.map(s => s.album)}
                keyExtractor={(album) => album.id}
                contentContainerStyle={{ paddingBottom }}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                maxToRenderPerBatch={10}
                windowSize={10}
                renderItem={renderAlbumItem}
              />
            ) : (
              <FlatList
                data={allTracks}
                keyExtractor={(item) => `${item.track.id}-${item.album.id}`}
                contentContainerStyle={{ paddingBottom }}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                maxToRenderPerBatch={15}
                windowSize={10}
                renderItem={renderAllSongItem}
              />
            )
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
              contentContainerStyle={{ paddingBottom }}
              showsVerticalScrollIndicator={false}
              removeClippedSubviews
              maxToRenderPerBatch={10}
              windowSize={10}
              renderItem={renderDownloadItem}
            />
          ) : (
            <EmptyState
              icon="download"
              title="No downloads"
              subtitle="Tap the download button to find and download music"
            />
          )
        )}
      </View>

      {!!currentAlbum && !showPlayer && <MiniPlayer onOpenPlayer={handleOpenPlayer} />}
      <PlayerSheet visible={showPlayer} onClose={handleClosePlayer} />
    </View>
  );
}
