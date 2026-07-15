import { useCallback, useRef, useMemo, useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  Dimensions,
  FlatList,
  PanResponder,
} from "react-native";
import BottomSheet, { BottomSheetBackdrop, BottomSheetView } from "@gorhom/bottom-sheet";
import { useMusicStore } from "@/stores/music-store";
import { useAudioPlayer } from "@/services/audio-player";
import Feather from "@expo/vector-icons/Feather";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const COVER_SIZE = SCREEN_WIDTH - 80;
const FULL_SNAP = SCREEN_HEIGHT - 50;

const formatTime = (ms: number) => {
  if (!ms || isNaN(ms)) return "0:00";
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const parseLyrics = (lyrics: string) =>
  lyrics.split("\n").map((line) => {
    const m = line.match(/\[(\d+):(\d+(?:\.\d+)?)\](.*)/);
    return m ? { time: parseInt(m[1]) * 60 + parseFloat(m[2]), text: m[3].trim() } : { time: -1, text: line };
  });

interface PlayerSheetProps {
  visible: boolean;
  onClose: () => void;
}

export function PlayerSheet({ visible, onClose }: PlayerSheetProps) {
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => [FULL_SNAP], []);
  const currentAlbum = useMusicStore((s) => s.currentAlbum);
  const currentTrackIndex = useMusicStore((s) => s.currentTrackIndex);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const position = useMusicStore((s) => s.position);
  const duration = useMusicStore((s) => s.duration);
  const setCurrentTrackIndex = useMusicStore((s) => s.setCurrentTrackIndex);
  const setPosition = useMusicStore((s) => s.setPosition);
  const { initialize, loadCurrentTrack, play, pause, seek, next, previous, currentTrack } = useAudioPlayer();
  const loadedAlbumRef = useRef<string | null>(null);
  const loadedIndexRef = useRef<number>(-1);
  const [showLyrics, setShowLyrics] = useState(false);
  const [showQueue, setShowQueue] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [dragX, setDragX] = useState(0);

  useEffect(() => {
    if (visible) initialize();
  }, [visible]);

  useEffect(() => {
    if (!currentAlbum) return;
    const albumChanged = loadedAlbumRef.current !== currentAlbum.id;
    const indexChanged = loadedIndexRef.current !== currentTrackIndex;
    if (albumChanged || indexChanged) {
      loadCurrentTrack();
      loadedAlbumRef.current = currentAlbum.id;
      loadedIndexRef.current = currentTrackIndex;
    }
  }, [currentAlbum, currentTrackIndex]);

  const handleClose = useCallback(() => {
    setShowLyrics(false);
    setShowQueue(false);
    onClose();
  }, [onClose]);

  const panResponder = useMemo(
    () => PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => { setIsDragging(true); setDragX(e.nativeEvent.locationX); },
      onPanResponderMove: (e) => setDragX(e.nativeEvent.locationX),
      onPanResponderRelease: (e) => {
        setIsDragging(false);
        const barW = SCREEN_WIDTH - 48;
        const pct = Math.max(0, Math.min(1, e.nativeEvent.locationX / barW));
        seek(pct * duration);
        setPosition(pct * duration);
      },
    }),
    [duration, seek, setPosition],
  );

  const track = useMemo(() => currentAlbum?.tracks[currentTrackIndex], [currentAlbum, currentTrackIndex]);
  const displayMs = isDragging
    ? Math.max(0, Math.min(duration, (dragX / Math.max(1, SCREEN_WIDTH - 48)) * duration))
    : position;
  const pct = duration > 0 ? Math.max(0, Math.min(100, (displayMs / duration) * 100)) : 0;
  const currentTrackLyrics = useMemo(
    () => currentTrack?.lyrics ? parseLyrics(currentTrack.lyrics) : null,
    [currentTrack?.lyrics]
  );
  const currentLyricIndex = useMemo(
    () => currentTrackLyrics
      ? currentTrackLyrics.findLastIndex((l) => l.time >= 0 && l.time <= position / 1000)
      : -1,
    [currentTrackLyrics, position]
  );

  const renderBackdrop = useCallback((props: any) => (
    <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} opacity={0.4} />
  ), []);

  const toggleQueue = useCallback(() => setShowQueue((v) => !v), []);
  const toggleLyrics = useCallback(() => setShowLyrics((v) => !v), []);
  const handleQueueSelect = useCallback((index: number) => {
    setCurrentTrackIndex(index);
    loadCurrentTrack(true).then(() => play());
  }, [setCurrentTrackIndex, loadCurrentTrack, play]);

  const renderQueueItem = useCallback(({ item, index }: { item: any; index: number }) => {
    const isCurrent = index === currentTrackIndex;
    return (
      <TouchableOpacity
        onPress={() => handleQueueSelect(index)}
        className={`flex-row items-center gap-3 py-2.5 px-3 rounded-xl mb-1 ${isCurrent ? "bg-ink-50" : ""}`}
      >
        <Text className={`text-xs font-bold w-6 text-center ${isCurrent ? "text-black" : "text-ink-400"}`}>
          {index + 1}
        </Text>
        <Image
          source={{ uri: item.coverUri || currentAlbum?.coverUri || "" }}
          className="w-9 h-9 rounded-md bg-ink-100"
          resizeMode="cover"
        />
        <View className="flex-1 min-w-0">
          <Text className={`text-sm ${isCurrent ? "font-bold text-black" : "text-ink-700"}`} numberOfLines={1}>{item.title}</Text>
          <Text className="text-xs text-ink-400">{item.artist}</Text>
        </View>
        <Text className="text-xs text-ink-400 tabular-nums">{formatTime(item.duration * 1000)}</Text>
      </TouchableOpacity>
    );
  }, [currentTrackIndex, currentAlbum?.coverUri, handleQueueSelect]);

  const renderLyricsItem = useCallback(({ item: line, index }: { item: { time: number; text: string }; index: number }) => (
    <Text
      className={`text-center py-1.5 leading-7 ${
        index === currentLyricIndex ? "text-lg font-bold text-black" : "text-sm text-ink-400"
      }`}
    >
      {line.text || "♪"}
    </Text>
  ), [currentLyricIndex]);

  if (!currentAlbum) return null;

  return (
      <BottomSheet
        ref={sheetRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        index={visible ? 0 : -1}
        handleIndicatorStyle={{ backgroundColor: "#cccccc", width: 40 }}
        backgroundStyle={{ backgroundColor: "#ffffff" }}
        backdropComponent={renderBackdrop}
        onChange={(index: number) => { if (index === -1) handleClose(); }}
      >
      <BottomSheetView className="flex-1 px-4 pb-6">
        <View className="flex-row items-center justify-between mb-4 px-2">
          <Text className="text-xs font-semibold text-ink-400 uppercase tracking-widest">Now Playing</Text>
          <TouchableOpacity onPress={handleClose} className="w-8 h-8 rounded-full items-center justify-center">
            <Feather name="chevron-down" size={22} color="#000" />
          </TouchableOpacity>
        </View>

        {!showLyrics && !showQueue && (
          <View className="items-center mt-2">
            <Image
              source={{ uri: currentAlbum.coverUri || track?.coverUri || "https://via.placeholder.com/300" }}
              style={{ width: COVER_SIZE, height: COVER_SIZE, borderRadius: 20 }}
              resizeMode="cover"
            />
          </View>
        )}

        {showQueue && currentAlbum ? (
          <FlatList
            data={currentAlbum.tracks}
            keyExtractor={(item) => item.id}
            className="flex-1 mt-2"
            showsVerticalScrollIndicator={false}
            removeClippedSubviews
            maxToRenderPerBatch={10}
            windowSize={10}
            renderItem={renderQueueItem}
          />
        ) : showLyrics && currentTrackLyrics ? (
          <FlatList
            data={currentTrackLyrics}
            keyExtractor={(_, i) => String(i)}
            className="flex-1 mt-2"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingVertical: 12 }}
            renderItem={renderLyricsItem}
          />
        ) : (
          <View className="items-center mt-4 px-4">
            <Text className="text-xl font-bold text-black text-center" numberOfLines={2}>
              {track?.title || currentAlbum?.title}
            </Text>
            <Text className="text-base text-ink-500 mt-1" numberOfLines={1}>{currentAlbum?.artist}</Text>
            <Text className="text-xs text-ink-400 mt-1">
              {currentAlbum?.title} · Track {currentTrackIndex + 1} of {currentAlbum?.trackCount}
            </Text>
          </View>
        )}

        {!showQueue && (
          <>
            <View className="px-2 mt-auto" style={{ marginTop: 16 }}>
              <View className="flex-row items-center" style={{ gap: 10 }} {...panResponder.panHandlers}>
                <Text className="text-xs text-ink-400 tabular-nums w-10 text-right">{formatTime(displayMs)}</Text>
                <View className="flex-1 h-1.5 bg-ink-100 rounded-full relative justify-center">
                  <View className="h-full bg-black rounded-full" style={{ width: `${pct}%` }} />
                  <View className="absolute w-3 h-3 bg-black rounded-full" style={{ left: `${pct}%`, marginLeft: -6 }} />
                </View>
                <Text className="text-xs text-ink-400 tabular-nums w-10">{formatTime(duration)}</Text>
              </View>
            </View>

            <View className="flex-row items-center justify-center px-4 mt-4" style={{ gap: 28 }}>
              <TouchableOpacity><Feather name="shuffle" size={18} color="#999" /></TouchableOpacity>
              <TouchableOpacity onPress={previous} className="w-10 h-10 items-center justify-center">
                <Feather name="skip-back" size={22} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={isPlaying ? pause : play}
                className="w-16 h-16 bg-black rounded-full items-center justify-center elevation-lg"
                style={{ shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 }}
              >
                <Feather name={isPlaying ? "pause" : "play"} size={28} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity onPress={next} className="w-10 h-10 items-center justify-center">
                <Feather name="skip-forward" size={22} color="#000" />
              </TouchableOpacity>
              <TouchableOpacity><Feather name="repeat" size={18} color="#999" /></TouchableOpacity>
            </View>

            <View className="flex-row items-center justify-around px-4 mt-4 pb-2">
              <TouchableOpacity onPress={toggleQueue} className="items-center" style={{ width: 56 }}>
                <Feather name="list" size={20} color={showQueue ? "#000" : "#999"} />
              </TouchableOpacity>
              <TouchableOpacity onPress={toggleLyrics} className="items-center" style={{ width: 56 }}>
                <Feather name="file-text" size={20} color={showLyrics ? "#000" : "#999"} />
              </TouchableOpacity>
              <TouchableOpacity className="items-center" style={{ width: 56 }}>
                <Feather name="heart" size={20} color="#999" />
              </TouchableOpacity>
              <TouchableOpacity className="items-center" style={{ width: 56 }}>
                <Feather name="share-2" size={20} color="#999" />
              </TouchableOpacity>
            </View>
          </>
        )}
      </BottomSheetView>
    </BottomSheet>
  );
}
