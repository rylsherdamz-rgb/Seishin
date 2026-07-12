import { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, FlatList, Image, Alert } from "react-native";
import { router } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useMusicStore } from "@/stores/music-store";
import { importLocalAudioFiles } from "@/services/music-import";
import { EmptyState } from "@/components/ui/EmptyState";
import { Card } from "@/components/ui/Card";
import { MiniPlayer } from "@/components/MiniPlayer";
import Feather from "@expo/vector-icons/Feather";

export default function MusicScreen() {
  const { albums, loadAlbums, setCurrentAlbum, currentAlbum } = useMusicStore();
  const [isImporting, setIsImporting] = useState(false);

  useEffect(() => {
    loadAlbums();
  }, [loadAlbums]);

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

  return (
    <View className="flex-1 bg-white">
      <View className="px-4 pt-3 pb-2">
        <View className="flex-row items-center justify-between mb-1">
          <View>
            <Text className="text-2xl font-semibold tracking-tightest text-black">Music</Text>
            <Text className="text-sm text-ink-500 mt-0.5">
              {albums.length > 0 ? `${albums.length} collection${albums.length === 1 ? "" : "s"}` : "Your audio library"}
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
              accessibilityLabel="Download music previews"
            >
              <Feather name="download" size={17} color="#ffffff" />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {albums.length > 0 ? (
        <FlatList
          data={albums}
          keyExtractor={(item) => item.id}
          contentContainerClassName={`px-4 ${currentAlbum ? "pb-40" : "pb-24"}`}
          numColumns={2}
          columnWrapperClassName="gap-3"
          renderItem={({ item }) => (
            <TouchableOpacity
              activeOpacity={0.7}
              className="flex-1"
              onPress={() => {
                setCurrentAlbum(item);
                router.push("/music-player");
              }}
            >
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
          subtitle="Import audio files from your phone, or tap + for Spotify previews"
        />
      )}

      <MiniPlayer />
    </View>
  );
}
