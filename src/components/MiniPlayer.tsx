import { View, Text, TouchableOpacity, Image } from "react-native";
import { router } from "expo-router";
import { useMusicStore } from "@/stores/music-store";
import { useAudioPlayer } from "@/services/audio-player";
import Feather from "@expo/vector-icons/Feather";

export function MiniPlayer() {
  const { currentAlbum, currentTrackIndex, isPlaying } = useMusicStore();
  const { play, pause, next, previous } = useAudioPlayer();
  const track = currentAlbum?.tracks[currentTrackIndex];
  if (!currentAlbum || !track) return null;

  return (
    <View
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        // The tab bar owns the device safe-area inset. Adding it again here
        // pushed the mini player unnecessarily high above the tabs.
        bottom: 70,
        backgroundColor: "#ffffff",
        borderTopColor: "#eeeeee",
        borderTopWidth: 1,
        shadowColor: "#000",
        shadowOpacity: 0.1,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: -3 },
        elevation: 14,
        zIndex: 50,
      }}
    >
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={() => router.push("/music-player")}
        className="flex-row items-center gap-3 px-4"
        style={{ height: 60 }}
      >
        <Image
          source={{ uri: currentAlbum.coverUri || track.coverUri || "" }}
          style={{ width: 42, height: 42, borderRadius: 8 }}
          resizeMode="cover"
        />
        <View className="flex-1 min-w-0">
          <Text className="text-sm font-semibold text-black" numberOfLines={1}>{track.title}</Text>
          <Text className="text-xs text-ink-400" numberOfLines={1}>{track.artist}</Text>
        </View>
        <TouchableOpacity onPress={previous} hitSlop={12} className="w-9 h-9 items-center justify-center">
          <Feather name="skip-back" size={20} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={isPlaying ? pause : play} hitSlop={12} className="w-9 h-9 items-center justify-center">
          <Feather name={isPlaying ? "pause" : "play"} size={22} color="#000" />
        </TouchableOpacity>
        <TouchableOpacity onPress={next} hitSlop={12} className="w-9 h-9 items-center justify-center">
          <Feather name="skip-forward" size={20} color="#000" />
        </TouchableOpacity>
      </TouchableOpacity>
    </View>
  );
}
