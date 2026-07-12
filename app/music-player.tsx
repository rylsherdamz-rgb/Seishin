import { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  ScrollView,
  PanResponder,
  Dimensions,
} from "react-native";
import { Stack, router } from "expo-router";
import { useMusicStore } from "@/stores/music-store";
import { useAudioPlayer } from "@/services/audio-player";
import { EmptyState } from "@/components/ui/EmptyState";
import Feather from "@expo/vector-icons/Feather";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const PROGRESS_WIDTH = SCREEN_WIDTH - 48;

export default function MusicPlayerScreen() {
  const {
    currentAlbum,
    currentTrackIndex,
    isPlaying,
    position,
    duration,
    setCurrentAlbum,
    setCurrentTrackIndex,
    setPlaying,
    setPosition,
    setDuration,
    playNext,
    playPrevious,
  } = useMusicStore();

  const { initialize, loadCurrentTrack, play, pause, seek, next, previous, setPlaybackRate, currentTrack } =
    useAudioPlayer();

  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState(1);
  const [isDraggingProgress, setIsDraggingProgress] = useState(false);
  const [dragPosition, setDragPosition] = useState(0);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onPanResponderGrant: () => {
          setIsDraggingProgress(true);
        },
        onPanResponderMove: (e, gestureState) => {
          const x = gestureState.x0 + gestureState.dx;
          const progress = Math.max(0, Math.min(1, x / PROGRESS_WIDTH));
          setDragPosition(progress * duration);
        },
        onPanResponderRelease: (e, gestureState) => {
          const x = gestureState.x0 + gestureState.dx;
          const progress = Math.max(0, Math.min(1, x / PROGRESS_WIDTH));
          setIsDraggingProgress(false);
          const newPosition = progress * duration;
          seek(newPosition);
          setPosition(newPosition);
        },
      }),
    [duration, seek, setPosition]
  );

  useEffect(() => {
    initialize();
    if (currentAlbum) {
      loadCurrentTrack();
    }
  }, [currentAlbum]);

  useEffect(() => {
    setPlaybackRate(playbackRate);
  }, [playbackRate]);

  const formatTime = (ms: number) => {
    const totalSeconds = Math.floor(ms / 1000);
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const parseLyrics = (lyrics: string) => {
    const lines = lyrics.split("\n");
    return lines.map((line) => {
      const timeMatch = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
      if (timeMatch) {
        const minutes = parseInt(timeMatch[1], 10);
        const seconds = parseFloat(timeMatch[2]);
        const text = timeMatch[3].trim();
        return { time: minutes * 60 + seconds, text };
      }
      return { time: -1, text: line };
    });
  };

  const currentTrackLyrics = currentTrack?.lyrics ? parseLyrics(currentTrack.lyrics) : null;
  const currentLyricIndex = currentTrackLyrics
    ? currentTrackLyrics.findIndex(
        (line, i) => line.time > position / 1000 && (i === 0 || currentTrackLyrics[i - 1].time <= position / 1000)
      )
    : -1;

  if (!currentAlbum) {
    return (
      <View className="flex-1 bg-white items-center justify-center">
        <EmptyState
          icon="music"
          title="No music playing"
          subtitle="Select an album from the Music tab to start playing"
        />
      </View>
    );
  }

  const currentTrackData = currentAlbum.tracks[currentTrackIndex];
  const displayPosition = isDraggingProgress ? dragPosition : position;
  const progressPercent = duration > 0 ? Math.max(0, Math.min(100, (displayPosition / duration) * 100)) : 0;

  return (
    <View className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100 }}
        showsVerticalScrollIndicator={false}
      >
        <View className="px-4 pt-4 pb-6">
          <View className="flex-row items-center justify-between mb-6">
            <TouchableOpacity onPress={() => router.back()} className="w-9 h-9 bg-ink-100 rounded-full items-center justify-center">
              <Feather name="chevron-down" size={20} color="#000" />
            </TouchableOpacity>
            <Text className="text-sm font-semibold text-black">Now Playing</Text>
            <TouchableOpacity className="w-9 h-9">
              <Feather name="more-horizontal" size={20} color="#000" />
            </TouchableOpacity>
          </View>

          <Image
            source={{ uri: currentAlbum.coverUri || "https://via.placeholder.com/300" }}
            style={{ width: "100%", aspectRatio: 1, borderRadius: 12 }}
            resizeMode="cover"
          />

          <View className="mt-6 items-center">
            <Text className="text-xl font-semibold text-black text-center px-4" numberOfLines={2}>
              {currentTrackData?.title || currentAlbum.title}
            </Text>
            <Text className="text-sm text-ink-500 mt-1">{currentAlbum.artist}</Text>
            <Text className="text-xs text-ink-400 mt-0.5">
              Track {currentTrackIndex + 1} of {currentAlbum.trackCount} · {currentAlbum.title}
            </Text>
          </View>
        </View>

        <View className="px-6 mt-4">
          <View className="flex-row items-center gap-3">
            <Text className="text-xs text-ink-400 tabular-nums w-12 text-right">{formatTime(displayPosition)}</Text>
            <View style={{ flex: 1, height: 4, backgroundColor: "#f0f0f0", borderRadius: 2, position: "relative" }} {...panResponder.panHandlers}>
              <View
                style={{
                  position: "absolute",
                  height: "100%",
                  backgroundColor: "#000",
                  borderRadius: 2,
                  width: `${progressPercent}%`,
                }}
              />
              <View
                style={{
                  position: "absolute",
                  top: "50%",
                  left: `${progressPercent}%`,
                  width: 12,
                  height: 12,
                  borderRadius: 6,
                  backgroundColor: "#000",
                  transform: [{ translateX: -6 }, { translateY: -6 }],
                }}
              />
            </View>
            <Text className="text-xs text-ink-400 tabular-nums w-12">{formatTime(duration)}</Text>
          </View>
        </View>

        <View className="px-8 mt-6 mb-4 flex-row items-center justify-center gap-8">
          <TouchableOpacity onPress={() => setPlaybackRateState((r) => (r <= 0.5 ? 1 : +(r - 0.25).toFixed(2)))} className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center">
            <Feather name="minus" size={18} color="#000" />
          </TouchableOpacity>
          <Text className={`text-lg font-mono font-semibold ${playbackRate !== 1 ? "text-black" : "text-ink-500"}`}>
            {playbackRate.toFixed(2)}x
          </Text>
          <TouchableOpacity onPress={() => setPlaybackRateState((r) => (r >= 2 ? 1 : +(r + 0.25).toFixed(2)))} className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center">
            <Feather name="plus" size={18} color="#000" />
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center justify-center gap-6 px-8 mb-6">
          <TouchableOpacity onPress={previous} className="w-12 h-12 bg-ink-100 rounded-full items-center justify-center">
            <Feather name="skip-back" size={24} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={isPlaying ? pause : play}
            className="w-16 h-16 bg-black rounded-full items-center justify-center"
            style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 4 }}
          >
            <Feather name={isPlaying ? "pause" : "play"} size={28} color="#fff" />
          </TouchableOpacity>
          <TouchableOpacity onPress={next} className="w-12 h-12 bg-ink-100 rounded-full items-center justify-center">
            <Feather name="skip-forward" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <View className="flex-row items-center justify-center gap-4 px-8 mb-8">
          <TouchableOpacity onPress={() => setPlaybackRateState((r) => (r === 0.5 ? 1 : 0.5))} className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center">
            <Feather name="repeat" size={18} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowQueue(!showQueue)} className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center">
            <Feather name="list" size={18} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setShowLyrics(!showLyrics)} className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center">
            <Feather name={showLyrics ? "file-text" : "music"} size={18} color="#000" />
          </TouchableOpacity>
          <TouchableOpacity className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center">
            <Feather name="shuffle" size={18} color="#000" />
          </TouchableOpacity>
        </View>

        {showQueue && (
          <View className="px-4 mb-6">
            <Text className="text-sm font-semibold text-black mb-3">Up Next</Text>
            {currentAlbum.tracks.map((item, index) => (
                <TouchableOpacity
                  key={item.id}
                  onPress={() => {
                    setCurrentTrackIndex(index);
                    loadCurrentTrack().then(play);
                  }}
                  className={`flex-row items-center gap-3 p-3 rounded-lg ${index === currentTrackIndex ? "bg-black/5" : ""}`}
                >
                  <View className="w-8 h-8 bg-ink-100 rounded-lg items-center justify-center flex-shrink-0">
                    <Text className={`text-xs font-semibold ${index === currentTrackIndex ? "text-black" : "text-ink-400"}`}>
                      {index + 1}
                    </Text>
                  </View>
                  <View className="flex-1 min-w-0">
                    <Text className={`text-sm ${index === currentTrackIndex ? "font-semibold text-black" : "font-medium text-ink-600"}`} numberOfLines={1}>
                      {item.title}
                    </Text>
                    <Text className="text-xs text-ink-400">{item.artist}</Text>
                  </View>
                  <Text className="text-xs text-ink-400 tabular-nums">{formatTime(item.duration * 1000)}</Text>
                  {index === currentTrackIndex && (
                    <Feather name="music" size={16} color="#000" />
                  )}
                </TouchableOpacity>
              ))}
          </View>
        )}

        {showLyrics && currentTrackLyrics && (
          <View className="px-4 mb-6">
            <Text className="text-sm font-semibold text-black mb-3">Lyrics</Text>
            <View>
              {currentTrackLyrics.map((line, index) => (
                <Text
                  key={index}
                  className={`text-center py-2 ${
                    index === currentLyricIndex
                      ? "text-lg font-semibold text-black"
                      : "text-sm text-ink-500"
                  }`}
                >
                  {line.text || "\u266A"}
                </Text>
              ))}
              {currentTrackLyrics.length === 0 && (
                <Text className="text-center text-ink-400 py-8">No lyrics available</Text>
              )}
            </View>
          </View>
        )}

        {showLyrics && !currentTrackData?.lyrics && (
          <View className="px-4 mb-6 items-center py-8">
            <Feather name="file-text" size={48} color="#cccccc" />
            <Text className="text-ink-400 mt-3 text-center">No lyrics available for this track</Text>
          </View>
        )}
      </ScrollView>

      <View
        className="absolute bottom-0 left-0 right-0 bg-white border-t border-ink-100 px-4 py-3"
        style={{ paddingBottom: 16 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1">
            <Image
              source={{ uri: currentAlbum.coverUri || "https://via.placeholder.com/60" }}
              style={{ width: 48, height: 48, borderRadius: 8 }}
              resizeMode="cover"
            />
            <View className="flex-1 min-w-0">
              <Text className="text-sm font-semibold text-black" numberOfLines={1}>
                {currentTrackData?.title || currentAlbum.title}
              </Text>
              <Text className="text-xs text-ink-400">{currentAlbum.artist}</Text>
            </View>
          </View>
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={previous} className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center">
              <Feather name="skip-back" size={20} color="#000" />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={isPlaying ? pause : play}
              className="w-12 h-12 bg-black rounded-full items-center justify-center"
            >
              <Feather name={isPlaying ? "pause" : "play"} size={24} color="#fff" />
            </TouchableOpacity>
            <TouchableOpacity onPress={next} className="w-10 h-10 bg-ink-100 rounded-full items-center justify-center">
              <Feather name="skip-forward" size={20} color="#000" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
