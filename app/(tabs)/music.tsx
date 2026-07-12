import { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, FlatList, Image } from "react-native";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import Feather from "@expo/vector-icons/Feather";

interface LocalAlbum {
  id: string;
  title: string;
  artist: string;
  coverUri?: string;
  trackCount: number;
  downloadedAt: string;
}

export default function MusicScreen() {
  const [albums, setAlbums] = useState<LocalAlbum[]>([]);
  const [playlistUrl, setPlaylistUrl] = useState("");

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center justify-between mb-1">
          <View>
            <Text className="text-2xl font-semibold tracking-tightest text-black">Music</Text>
            <Text className="text-sm text-ink-500 mt-0.5">
              {albums.length > 0 ? `${albums.length} album${albums.length === 1 ? "" : "s"}` : "Downloaded albums"}
            </Text>
          </View>
        </View>
      </View>

      <View className="mx-4 mb-4 h-11 bg-ink-50 rounded-xl px-4 flex-row items-center gap-2">
        <Feather name="link" size={15} color="#999999" />
        <TextInput
          className="flex-1 text-sm text-black"
          placeholder="Paste Spotify playlist or album URL"
          placeholderTextColor="#999999"
          value={playlistUrl}
          onChangeText={setPlaylistUrl}
        />
        {playlistUrl.length > 0 && (
          <TouchableOpacity
            onPress={() => { /* TODO: download playlist */ }}
            className="w-8 h-8 bg-black rounded-full items-center justify-center"
          >
            <Feather name="download" size={14} color="#ffffff" />
          </TouchableOpacity>
        )}
      </View>

      {albums.length > 0 ? (
        <FlatList
          data={albums}
          keyExtractor={(item) => item.id}
          contentContainerClassName="px-4 pb-8"
          numColumns={2}
          columnWrapperClassName="gap-3"
          renderItem={({ item }) => (
            <TouchableOpacity activeOpacity={0.7} className="flex-1">
              <Card variant="elevated" className="overflow-hidden">
                {item.coverUri ? (
                  <Image source={{ uri: item.coverUri }} className="w-full aspect-square" />
                ) : (
                  <View className="w-full aspect-square bg-ink-100 items-center justify-center">
                    <Feather name="music" size={32} color="#cccccc" />
                  </View>
                )}
                <View className="p-3">
                  <Text className="text-sm font-semibold text-black" numberOfLines={1}>{item.title}</Text>
                  <Text className="text-xs text-ink-400 mt-0.5">{item.artist}</Text>
                  <Text className="text-[10px] text-ink-300 mt-1">
                    {item.trackCount} tracks · {new Date(item.downloadedAt).toLocaleDateString()}
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          )}
        />
      ) : (
        <EmptyState
          icon="music"
          title="No music yet"
          subtitle="Paste a Spotify playlist or album URL above to download it"
        />
      )}
    </View>
  );
}
