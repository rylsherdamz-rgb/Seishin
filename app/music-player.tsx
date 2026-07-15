import { useEffect, useState, useMemo, useRef, useCallback } from "react";
import {
  View, Text, Pressable, ScrollView, PanResponder, Dimensions, FlatList,
} from "react-native";
import { Image } from "expo-image";
import { Stack, router } from "expo-router";
import { useMusicStore } from "@/stores/music-store";
import { useAudioPlayer } from "@/services/audio-player";
import { EmptyState } from "@/components/ui/EmptyState";
import Feather from "@expo/vector-icons/Feather";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const COVER_SIZE = SCREEN_WIDTH - 64;

const formatTime = (ms: number) => {
  if (!ms || isNaN(ms)) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  return `${Math.floor(totalSec / 60)}:${String(totalSec % 60).padStart(2, "0")}`;
};

const parseLyrics = (lyrics: string) => {
  return lyrics.split("\n").map((line) => {
    const m = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    if (m) return { time: parseInt(m[1]) * 60 + parseFloat(m[2]), text: m[3].trim() };
    return { time: -1, text: line };
  });
};

export default function MusicPlayerScreen() {
  const currentAlbum = useMusicStore((s) => s.currentAlbum);
  const currentTrackIndex = useMusicStore((s) => s.currentTrackIndex);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const position = useMusicStore((s) => s.position);
  const duration = useMusicStore((s) => s.duration);
  const favorites = useMusicStore((s) => s.favorites);
  const repeat = useMusicStore((s) => s.repeat);
  const shuffle = useMusicStore((s) => s.shuffle);
  const setCurrentTrackIndex = useMusicStore((s) => s.setCurrentTrackIndex);
  const setPosition = useMusicStore((s) => s.setPosition);
  const toggleFavorite = useMusicStore((s) => s.toggleFavorite);
  const setRepeat = useMusicStore((s) => s.setRepeat);
  const setShuffle = useMusicStore((s) => s.setShuffle);

  const { initialize, loadCurrentTrack, play, pause, seek, next, previous, currentTrack } =
    useAudioPlayer();
  const loadedAlbumRef = useRef<string | null>(null);
  const loadedIndexRef = useRef<number>(-1);

  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);
  const lyricsScrollRef = useRef<FlatList<any>>(null);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          setIsDragging(true);
          setDragX(e.nativeEvent.locationX);
        },
        onPanResponderMove: (e) => {
          setDragX(e.nativeEvent.locationX);
        },
        onPanResponderRelease: (e) => {
          setIsDragging(false);
          const barWidth = SCREEN_WIDTH - 48;
          const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / barWidth));
          const newPos = pct * duration;
          seek(newPos);
          setPosition(newPos);
        },
      }),
    [duration, seek, setPosition]
  );

  useEffect(() => {
    initialize();
    if (!currentAlbum) return;
    const albumChanged = loadedAlbumRef.current !== currentAlbum.id;
    const indexChanged = loadedIndexRef.current !== currentTrackIndex;
    if (albumChanged || indexChanged) {
      loadCurrentTrack().then(() => {
        if (isPlaying) play();
      });
      loadedAlbumRef.current = currentAlbum.id;
      loadedIndexRef.current = currentTrackIndex;
    }
  }, [currentAlbum, currentTrackIndex, initialize, loadCurrentTrack, isPlaying, play]);

  const currentTrackLyrics = useMemo(
    () => currentTrack?.lyrics ? parseLyrics(currentTrack.lyrics) : null,
    [currentTrack?.lyrics]
  );

  const currentLyricIndex = useMemo(
    () => currentTrackLyrics
      ? currentTrackLyrics.findLastIndex((l) => l.time >= 0 && l.time < position / 1000)
      : -1,
    [currentTrackLyrics, position]
  );

  useEffect(() => {
    if (showLyrics && currentLyricIndex >= 0 && lyricsScrollRef.current) {
      lyricsScrollRef.current.scrollToIndex({ index: Math.max(0, currentLyricIndex - 1), animated: false, viewPosition: 0.5 });
    }
  }, [currentLyricIndex, showLyrics]);

  const renderLyricsItem = useCallback(({ item: line, index }: { item: { time: number; text: string }; index: number }) => {
    const isCurrent = index === currentLyricIndex;
    return (
      <Text
        className={`text-center py-2 leading-7 ${
          isCurrent ? "text-xl font-bold text-black" : "text-base text-ink-400"
        }`}
      >
        {line.text || "♪"}
      </Text>
    );
  }, [currentLyricIndex]);

  const handleToggleQueue = useCallback(() => setShowQueue((v) => !v), []);
  const handleToggleLyrics = useCallback(() => setShowLyrics((v) => !v), []);

  const renderQueueTrack = useCallback(({ item, index }: { item: any; index: number }) => {
    const isCurrent = index === currentTrackIndex;
    return (
      <Pressable
        onPress={() => {
          setCurrentTrackIndex(index);
          loadCurrentTrack(true).then(() => play());
        }}
        className={`flex-row items-center gap-3 py-3 px-3 rounded-xl mb-1 ${isCurrent ? "bg-ink-50" : ""}`}
      >
        <View className="w-8 h-8 rounded-lg bg-ink-100 items-center justify-center">
          <Text className={`text-xs font-bold ${isCurrent ? "text-black" : "text-ink-400"}`}>
            {index + 1}
          </Text>
        </View>
        <Image source={{ uri: item.coverUri || currentAlbum?.coverUri || "" }} className="w-10 h-10 rounded-md bg-ink-100" contentFit="cover" />
        <View className="flex-1 min-w-0">
          <Text className={`text-sm ${isCurrent ? "font-bold text-black" : "font-medium text-ink-700"}`} numberOfLines={1}>
            {item.title}
          </Text>
          <Text className="text-xs text-ink-400">{item.artist}</Text>
        </View>
        <Text className="text-xs text-ink-400 tabular-nums">{formatTime(item.duration * 1000)}</Text>
        {isCurrent && <Feather name="speaker" size={14} color="#000" />}
      </Pressable>
    );
  }, [currentTrackIndex, currentAlbum?.coverUri, setCurrentTrackIndex, loadCurrentTrack, play]);

  const isFav = currentTrack ? favorites.includes(currentTrack.id) : false;

  const cycleRepeat = useCallback(() => {
    const modes: ("off" | "all" | "one")[] = ["off", "all", "one"];
    const idx = modes.indexOf(repeat);
    setRepeat(modes[(idx + 1) % modes.length]);
  }, [repeat, setRepeat]);

  const handleToggleShuffle = useCallback(() => {
    setShuffle(!shuffle);
  }, [shuffle, setShuffle]);

  const handleToggleFav = useCallback(() => {
    if (currentTrack) toggleFavorite(currentTrack.id);
  }, [currentTrack, toggleFavorite]);

  if (!currentAlbum) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <EmptyState icon="music" title="No music playing" subtitle="Select an album from the Music tab" />
      </View>
    );
  }

  const track = currentAlbum.tracks[currentTrackIndex];
  const displayMs = isDragging
    ? Math.max(0, Math.min(duration, (dragX / Math.max(1, SCREEN_WIDTH - 48)) * duration))
    : position;
  const pct = duration > 0 ? Math.max(0, Math.min(100, (displayMs / duration) * 100)) : 0;

  const nowLyrics = showLyrics && currentTrackLyrics;

  const repeatColor = repeat !== "off" ? "#000" : "#999";
  const shuffleColor = shuffle ? "#000" : "#999";

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />

      <View className="pt-2 px-4 pb-2 flex-row items-center justify-between">
        <Pressable onPress={() => router.back()} className="w-10 h-10 rounded-full items-center justify-center">
          <Feather name="chevron-down" size={24} color="#000" />
        </Pressable>
        <Text className="text-xs font-semibold text-ink-400 uppercase tracking-widest">Now Playing</Text>
        <View className="w-10 h-10" />
      </View>

      {showLyrics || showQueue ? (
        <View className="flex-1">
          {showQueue ? (
            <View className="px-4 mt-4 flex-1">
              <Text className="text-lg font-bold text-black mb-3">Queue</Text>
              <FlatList
                data={currentAlbum.tracks}
                keyExtractor={(item) => item.id}
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
                maxToRenderPerBatch={10}
                windowSize={10}
                renderItem={renderQueueTrack}
              />
            </View>
          ) : nowLyrics ? (
            <View className="flex-1 px-6 mt-4">
              <FlatList
                ref={lyricsScrollRef}
                data={currentTrackLyrics}
                keyExtractor={(_, i) => String(i)}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingVertical: 20 }}
                renderItem={renderLyricsItem}
                ListEmptyComponent={
                  <View className="items-center py-16">
                    <Feather name="file-text" size={32} color="#ccc" />
                    <Text className="text-ink-400 mt-2">No lyrics available</Text>
                  </View>
                }
              />
            </View>
          ) : null}
        </View>
      ) : (
        <ScrollView className="flex-1" showsVerticalScrollIndicator={false} contentContainerClassName="pb-10">
          <View className="items-center px-8 mt-2">
            <Image
              key={currentTrackIndex}
              source={{ uri: track?.coverUri || currentAlbum.coverUri || "https://via.placeholder.com/300" }}
              style={{ width: COVER_SIZE, height: COVER_SIZE, borderRadius: 20 }}
              contentFit="cover"
            />
          </View>

          <View className="px-8 mt-6 items-center">
            <Text className="text-xl font-bold text-black text-center" numberOfLines={2}>
              {track?.title || currentAlbum.title}
            </Text>
            <Text className="text-base text-ink-500 mt-1.5" numberOfLines={1}>{currentAlbum.artist}</Text>
            <Text className="text-xs text-ink-400 mt-1">
              {currentAlbum.title} · Track {currentTrackIndex + 1} of {currentAlbum.trackCount}
            </Text>
          </View>

          <View className="px-6 mt-6 h-12">
            <View className="flex-row items-center gap-3" {...panResponder.panHandlers}>
              <Text className="text-xs text-ink-400 tabular-nums w-10 text-right">{formatTime(displayMs)}</Text>
              <View className="flex-1 h-1.5 bg-ink-100 rounded-full relative justify-center">
                <View className="h-full bg-black rounded-full" style={{ width: `${pct}%` }} />
                <View
                  className="absolute w-3.5 h-3.5 bg-black rounded-full"
                  style={{ left: `${pct}%`, marginLeft: -7 }}
                />
              </View>
              <Text className="text-xs text-ink-400 tabular-nums w-10">{formatTime(duration)}</Text>
            </View>
          </View>

          <View className="flex-row items-center justify-center px-8 mt-4 gap-8">
            <Pressable onPress={handleToggleShuffle}>
              <Feather name="shuffle" size={18} color={shuffleColor} />
            </Pressable>
            <Pressable onPress={previous} className="w-12 h-12 items-center justify-center">
              <Feather name="skip-back" size={24} color="#000" />
            </Pressable>
            <Pressable
              onPress={isPlaying ? pause : play}
              className="w-20 h-20 bg-black rounded-full items-center justify-center shadow-float"
            >
              <Feather name={isPlaying ? "pause" : "play"} size={32} color="#fff" />
            </Pressable>
            <Pressable onPress={next} className="w-12 h-12 items-center justify-center">
              <Feather name="skip-forward" size={24} color="#000" />
            </Pressable>
            <Pressable onPress={cycleRepeat}>
              <Feather name="repeat" size={18} color={repeatColor} />
            </Pressable>
          </View>
        </ScrollView>
      )}

      {!showQueue && (
        <View className="px-8 pb-6 pt-2 flex-row items-center justify-between border-t border-ink-50">
          <Pressable onPress={handleToggleFav} className="items-center w-[60px]">
            <Feather name={isFav ? "heart" : "heart"} size={20} color={isFav ? "#ff3b30" : "#999"} />
          </Pressable>
          <Pressable
            onPress={handleToggleQueue}
            className="items-center w-[60px]"
          >
            <Feather name="list" size={20} color={showQueue ? "#000" : "#999"} />
          </Pressable>
          <Pressable
            onPress={handleToggleLyrics}
            className="items-center w-[60px]"
          >
            <Feather name="file-text" size={20} color={showLyrics ? "#000" : "#999"} />
          </Pressable>
        </View>
      )}
    </View>
  );
}
