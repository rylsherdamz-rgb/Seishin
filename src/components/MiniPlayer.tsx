import { View, Text, TouchableOpacity, Image } from "react-native";
import { useMusicStore } from "@/stores/music-store";
import { useAudioPlayer } from "@/services/audio-player";
import Feather from "@expo/vector-icons/Feather";

interface MiniPlayerProps {
  onOpenPlayer: () => void;
}

export function MiniPlayer({ onOpenPlayer }: MiniPlayerProps) {
  const currentAlbum = useMusicStore((s) => s.currentAlbum);
  const currentTrackIndex = useMusicStore((s) => s.currentTrackIndex);
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const { play, pause, next, previous } = useAudioPlayer();
  const track = currentAlbum?.tracks[currentTrackIndex];
  if (!currentAlbum || !track) return null;

  return (
    <TouchableOpacity
      activeOpacity={0.95}
      onPress={onOpenPlayer}
      className="flex-row items-center px-3 py-2 bg-ink-25 border-t border-ink-100 border-b border-ink-100"
    >
      <Image
        source={{ uri: currentAlbum.coverUri || track.coverUri || "" }}
        style={{ width: 44, height: 44, borderRadius: 8 }}
        resizeMode="cover"
      />
      <View className="flex-1 min-w-0 px-3">
        <Text className="text-sm font-semibold text-black leading-5" numberOfLines={1}>
          {track.title}
        </Text>
        <Text className="text-xs text-ink-400 leading-4" numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
      <View className="flex-row items-center" style={{ gap: 2 }}>
        <TouchableOpacity
          onPress={previous}
          hitSlop={10}
          className="w-9 h-9 items-center justify-center"
        >
          <Feather name="skip-back" size={18} color="#555" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={isPlaying ? pause : play}
          hitSlop={10}
          className="w-10 h-10 bg-black rounded-full items-center justify-center mx-1"
        >
          <Feather name={isPlaying ? "pause" : "play"} size={18} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity
          onPress={next}
          hitSlop={10}
          className="w-9 h-9 items-center justify-center"
        >
          <Feather name="skip-forward" size={18} color="#555" />
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}
