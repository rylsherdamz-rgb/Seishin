import { useState, useCallback } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Image, Alert, Modal } from "react-native";
import { Stack, router } from "expo-router";
import { useMusicStore, DownloadItem } from "@/stores/music-store";
import { searchTracks, downloadTrack, downloadAlbum, downloadPlaylist, SearchResult, SearchResponse, AlbumResult, PlaylistResult } from "@/services/music-download";
import type { TrackData, DownloadProgress } from "@/services/music-download";
import Feather from "@expo/vector-icons/Feather";

export default function MusicDownloadScreen() {
  const [query, setQuery] = useState("");
  const [searchResult, setSearchResult] = useState<SearchResponse | null>(null);
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [detailModal, setDetailModal] = useState<{
    type: "album" | "playlist";
    data: AlbumResult | PlaylistResult;
    tracks: SearchResult[];
    loading: boolean;
  } | null>(null);
  const addAlbum = useMusicStore((s) => s.addAlbum);
  const loadAlbums = useMusicStore((s) => s.loadAlbums);
  const storeDownloads = useMusicStore((s) => s.downloads);
  const addDownload = useMusicStore((s) => s.addDownload);
  const updateDownload = useMusicStore((s) => s.updateDownload);
  const removeDownload = useMusicStore((s) => s.removeDownload);

  function findDl(id: string): DownloadItem | undefined {
    return storeDownloads.find((d) => d.id === id);
  }

  const doSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    setSearched(true);
    try {
      const result = await searchTracks(query.trim());
      setSearchResult(result);
    } catch (e) {
      console.error("[searchUI] search error:", e);
      setSearchResult({ songs: [], albums: [], playlists: [] });
    } finally {
      setSearching(false);
    }
  }, [query]);

  const onTrackComplete = useCallback((data: TrackData) => {
    addAlbum({
      id: `album-${data.id}`,
      title: data.title,
      artist: data.artist,
      coverUri: data.coverUri,
      trackCount: 1,
      totalDuration: data.duration,
      downloadedAt: data.downloadedAt,
      tracks: [data],
    });
    loadAlbums();
  }, [addAlbum, loadAlbums]);

  const doDownloadTrack = useCallback(async (track: SearchResult) => {
    const dlKey = `track-${track.videoId}`;
    if (findDl(dlKey)?.status === "downloading") return;
    addDownload({ id: dlKey, title: track.title, artist: track.artist, progress: 0, status: "downloading" });

    try {
      await downloadTrack(track, {
        onProgress: (p) => updateDownload(dlKey, { progress: p.progress, title: p.trackTitle }),
        onComplete: (data) => {
          updateDownload(dlKey, { progress: 1, status: "completed" });
          onTrackComplete(data);
        },
        onError: (error) => updateDownload(dlKey, { status: "error", error: error.message }),
      });
    } catch {}
  }, [storeDownloads]);

  const doDownloadAlbum = useCallback(async (item: AlbumResult) => {
    const dlKey = `album-${item.browseId}`;
    if (findDl(dlKey)?.status === "downloading") return;
    addDownload({ id: dlKey, title: item.title, artist: item.artist, progress: 0, status: "downloading" });
    let completed = 0;
    try {
      const tracks = await downloadAlbum(item.browseId, {
        onComplete: (data) => {
          completed++;
          updateDownload(dlKey, { progress: completed / 20, title: `${completed} tracks` });
          onTrackComplete(data);
        },
        onError: () => {},
      });
      updateDownload(dlKey, { progress: 1, status: "completed", title: `${tracks.length} tracks` });
    } catch {
      updateDownload(dlKey, { status: "error" });
    }
  }, [storeDownloads, onTrackComplete]);

  const doDownloadPlaylist = useCallback(async (item: PlaylistResult) => {
    const dlKey = `pl-${item.browseId}`;
    if (findDl(dlKey)?.status === "downloading") return;
    addDownload({ id: dlKey, title: item.title, artist: "", progress: 0, status: "downloading" });
    let completed = 0;
    try {
      const tracks = await downloadPlaylist(item.browseId, {
        onComplete: (data) => {
          completed++;
          updateDownload(dlKey, { progress: completed / 50, title: `${completed} tracks` });
          onTrackComplete(data);
        },
        onError: () => {},
      });
      updateDownload(dlKey, { progress: 1, status: "completed", title: `${tracks.length} tracks` });
    } catch {
      updateDownload(dlKey, { status: "error" });
    }
  }, [storeDownloads, onTrackComplete]);

  const openDetail = useCallback(async (type: "album" | "playlist", item: AlbumResult | PlaylistResult) => {
    setDetailModal({ type, data: item, tracks: [], loading: true });
    try {
      const { getAlbumTracks, getPlaylistTracks } = await import("@/services/music-download");
      const result = type === "album"
        ? await getAlbumTracks((item as AlbumResult).browseId)
        : await getPlaylistTracks((item as PlaylistResult).browseId);
      setDetailModal((prev) => prev ? { ...prev, tracks: result.tracks, loading: false } : null);
    } catch {
      setDetailModal(null);
    }
  }, []);

  const doDownloadAllFromModal = useCallback(async () => {
    if (!detailModal || detailModal.tracks.length === 0) return;
    const { tracks } = detailModal;
    let completed = 0;
    for (const track of tracks) {
      const dlKey = `track-${track.videoId}`;
      if (findDl(dlKey)?.status === "completed") { completed++; continue; }
      try {
        await downloadTrack(track, {
          onProgress: (p) => updateDownload(dlKey, { progress: p.progress, title: p.trackTitle }),
          onComplete: (data) => { updateDownload(dlKey, { progress: 1, status: "completed" }); completed++; onTrackComplete(data); },
          onError: () => {},
        });
      } catch {}
    }
    if (completed === tracks.length) setDetailModal(null);
  }, [detailModal, storeDownloads, onTrackComplete]);

  function formatDuration(seconds: number): string {
    if (!seconds) return "";
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
  }

  function getThumbUrl(thumbnail: string, videoId?: string): string {
    return thumbnail || (videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : "");
  }

  const completedCount = storeDownloads.filter((d) => d.status === "completed").length;

  function renderTrackItem(track: SearchResult, showIndex?: number) {
    const dl = findDl(`track-${track.videoId}`);
    const isDl = dl?.status === "downloading";
    const isDone = dl?.status === "completed";
    return (
      <TouchableOpacity
        key={track.videoId}
        onPress={() => doDownloadTrack(track)}
        disabled={isDl || isDone}
        className={`flex-row items-center gap-3 py-3 border-b border-ink-50 ${isDone ? "opacity-60" : ""}`}
        activeOpacity={0.7}
      >
        {showIndex !== undefined && <Text className="text-xs text-ink-300 w-6 text-center">{showIndex}</Text>}
        <Image source={{ uri: getThumbUrl(track.thumbnail, track.videoId) }} className="w-12 h-12 rounded-lg bg-ink-100" resizeMode="cover" />
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-medium text-black" numberOfLines={1}>{track.title}</Text>
          <Text className="text-xs text-ink-400" numberOfLines={1}>{track.artist}</Text>
          {track.duration > 0 && <Text className="text-[10px] text-ink-300 mt-0.5">{formatDuration(track.duration)}</Text>}
        </View>
        {dl?.status === "error" && <Feather name="alert-circle" size={18} color="#ef4444" />}
        {isDl && <View className="w-9 h-9 rounded-full border-2 border-black items-center justify-center"><Text className="text-[10px] font-bold">{Math.round(dl.progress * 100)}%</Text></View>}
        {isDone && <Feather name="check-circle" size={20} color="#2fbf71" />}
        {!isDl && !isDone && dl?.status !== "error" && <Feather name="download" size={18} color="#999" />}
      </TouchableOpacity>
    );
  }

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
            <Feather name="arrow-left" size={16} color="#000" />
          </TouchableOpacity>
          <Text className="text-lg font-semibold tracking-tightest text-black">Download Music</Text>
        </View>
        {completedCount > 0 && <Text className="text-xs text-ink-400">{completedCount} downloaded</Text>}
      </View>

      <View className="mx-4 mt-1 mb-2">
        <View className="flex-row gap-2 items-center">
          <View className="flex-1 h-11 bg-ink-50 rounded-xl px-4 flex-row items-center gap-2">
            <Feather name="search" size={15} color="#999" />
            <TextInput
              className="flex-1 text-sm text-black"
              placeholder="Search songs, albums, playlists..."
              placeholderTextColor="#999"
              value={query}
              onChangeText={setQuery}
              onSubmitEditing={doSearch}
              returnKeyType="search"
              autoCapitalize="none"
              autoCorrect={false}
            />
            {query.length > 0 && (
              <TouchableOpacity onPress={() => { setQuery(""); setSearchResult(null); setSearched(false); }}>
                <Feather name="x-circle" size={15} color="#ccc" />
              </TouchableOpacity>
            )}
          </View>
          <TouchableOpacity
            onPress={doSearch}
            disabled={!query.trim() || searching}
            className={`h-11 w-11 rounded-xl items-center justify-center ${query.trim() && !searching ? "bg-black" : "bg-ink-200"}`}
          >
            <Feather name={searching ? "loader" : "search"} size={16} color="#fff" />
          </TouchableOpacity>
        </View>
      </View>

      {searching ? (
        <View className="items-center justify-center py-32"><Feather name="loader" size={24} color="#ccc" /><Text className="text-sm text-ink-300 mt-3">Searching...</Text></View>
      ) : !searched ? (
        <View className="items-center justify-center py-32">
          <View className="w-16 h-16 bg-ink-50 border border-ink-100 rounded-full items-center justify-center mb-4"><Feather name="search" size={24} color="#ccc" /></View>
          <Text className="text-base font-medium text-ink-400 text-center">Search for music</Text>
          <Text className="text-sm text-ink-200 mt-1 text-center max-w-[260px]">Find songs, albums, and playlists to download</Text>
        </View>
      ) : !searchResult?.songs.length && !searchResult?.albums.length && !searchResult?.playlists.length ? (
        <View className="items-center justify-center py-32"><Feather name="frown" size={24} color="#ccc" /><Text className="text-sm text-ink-300 mt-3">No results found</Text></View>
      ) : (
        <FlatList
          data={["songs", "albums", "playlists"]}
          keyExtractor={(s) => s}
          contentContainerClassName="px-4 pb-8"
          renderItem={({ item: section }) => {
            if (section === "songs" && searchResult?.songs.length) {
              return (
                <View className="mb-6">
                  <Text className="text-xs font-semibold tracking-wider text-ink-400 uppercase mb-2 ml-1">Songs</Text>
                  {searchResult.songs.map((t) => renderTrackItem(t))}
                </View>
              );
            }
            if (section === "albums" && searchResult?.albums.length) {
              return (
                <View className="mb-6">
                  <Text className="text-xs font-semibold tracking-wider text-ink-400 uppercase mb-2 ml-1">Albums</Text>
                  {searchResult.albums.map((a) => {
                    const dl = findDl(`album-${a.browseId}`);
                    const isDl = dl?.status === "downloading";
                    const isDone = dl?.status === "completed";
                    return (
                      <TouchableOpacity
                        key={a.browseId}
                        onPress={() => openDetail("album", a)}
                        className="flex-row items-center gap-3 py-3 border-b border-ink-50"
                        activeOpacity={0.7}
                      >
                        <Image source={{ uri: getThumbUrl(a.thumbnail) }} className="w-14 h-14 rounded-lg bg-ink-100" resizeMode="cover" />
                        <View className="flex-1 min-w-0">
                          <Text className="text-sm font-medium text-black" numberOfLines={1}>{a.title}</Text>
                          <Text className="text-xs text-ink-400" numberOfLines={1}>{a.artist}{a.year ? ` • ${a.year}` : ""}{a.trackCount ? ` • ${a.trackCount} tracks` : ""}</Text>
                          {dl && <Text className="text-[10px] text-ink-300 mt-0.5">{dl.title}</Text>}
                        </View>
                        <TouchableOpacity
                          onPress={() => doDownloadAlbum(a)}
                          disabled={isDl || isDone}
                          className={`w-9 h-9 rounded-full items-center justify-center ${isDone ? "bg-success/10" : isDl ? "border-2 border-black" : "bg-black"}`}
                        >
                          {isDl ? <Text className="text-[10px] font-bold">{Math.round(dl.progress * 100)}%</Text>
                          : isDone ? <Feather name="check" size={16} color="#2fbf71" />
                          : <Feather name="download" size={16} color="#fff" />}
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            }
            if (section === "playlists" && searchResult?.playlists.length) {
              return (
                <View className="mb-6">
                  <Text className="text-xs font-semibold tracking-wider text-ink-400 uppercase mb-2 ml-1">Playlists</Text>
                  {searchResult.playlists.map((p) => {
                    const dl = findDl(`pl-${p.browseId}`);
                    const isDl = dl?.status === "downloading";
                    const isDone = dl?.status === "completed";
                    return (
                      <TouchableOpacity
                        key={p.browseId}
                        onPress={() => openDetail("playlist", p)}
                        className="flex-row items-center gap-3 py-3 border-b border-ink-50"
                        activeOpacity={0.7}
                      >
                        <Image source={{ uri: getThumbUrl(p.thumbnail) }} className="w-14 h-14 rounded-lg bg-ink-100" resizeMode="cover" />
                        <View className="flex-1 min-w-0">
                          <Text className="text-sm font-medium text-black" numberOfLines={1}>{p.title}</Text>
                          <Text className="text-xs text-ink-400">{p.trackCount ? `${p.trackCount} tracks` : ""}</Text>
                          {dl && <Text className="text-[10px] text-ink-300 mt-0.5">{dl.title}</Text>}
                        </View>
                        <TouchableOpacity
                          onPress={() => doDownloadPlaylist(p)}
                          disabled={isDl || isDone}
                          className={`w-9 h-9 rounded-full items-center justify-center ${isDone ? "bg-success/10" : isDl ? "border-2 border-black" : "bg-black"}`}
                        >
                          {isDl ? <Text className="text-[10px] font-bold">{Math.round(dl.progress * 100)}%</Text>
                          : isDone ? <Feather name="check" size={16} color="#2fbf71" />
                          : <Feather name="download" size={16} color="#fff" />}
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            }
            return null;
          }}
        />
      )}

      <Modal visible={!!detailModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-white">
          <View className="px-4 pt-3 pb-2 flex-row items-center justify-between">
            <View className="flex-row items-center gap-3 flex-1">
              <TouchableOpacity onPress={() => setDetailModal(null)} className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
                <Feather name="arrow-left" size={16} color="#000" />
              </TouchableOpacity>
              <Text className="text-lg font-semibold tracking-tightest text-black flex-1" numberOfLines={1}>{detailModal?.data?.title || "Loading..."}</Text>
            </View>
            {detailModal && detailModal.tracks.length > 0 && (
              <TouchableOpacity onPress={doDownloadAllFromModal} className="bg-black px-4 py-2 rounded-xl">
                <Text className="text-sm font-medium text-white">Download All</Text>
              </TouchableOpacity>
            )}
          </View>
          {detailModal?.loading ? (
            <View className="items-center justify-center py-32"><Feather name="loader" size={24} color="#ccc" /><Text className="text-sm text-ink-300 mt-3">Loading tracks...</Text></View>
          ) : (
            <FlatList
              data={detailModal?.tracks || []}
              keyExtractor={(t) => t.videoId}
              contentContainerClassName="px-4 pb-8"
              renderItem={({ item, index }) => renderTrackItem(item, index + 1)}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
