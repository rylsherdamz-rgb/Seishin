import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import type { DocumentPickerAsset } from "expo-document-picker";
import { useMusicStore, type Album, type Track } from "@/stores/music-store";

function id(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function titleFromFilename(name: string): string {
  return name.replace(/\.[^.]+$/, "").replace(/[._-]+/g, " ").trim() || "Untitled track";
}

/**
 * Copies audio picked through the Android/iOS system picker into app storage.
 * Keeping our own copy means the music remains playable after the picker cache
 * is cleaned or the original is moved.
 */
export async function importLocalAudioFiles(assets: DocumentPickerAsset[]): Promise<Album> {
  if (!assets.length) throw new Error("No audio files selected.");

  const albumId = id();
  const albumDir = new Directory(Paths.document, "Music", albumId);
  albumDir.create({ idempotent: true, intermediates: true });
  const downloadedAt = new Date().toISOString();

  const tracks: Track[] = [];
  for (let index = 0; index < assets.length; index += 1) {
    const asset = assets[index];
    const safeName = asset.name.replace(/[^a-zA-Z0-9._-]/g, "_") || `track-${index + 1}.audio`;
    let audioUri = asset.uri;

    if (Platform.OS !== "web") {
      const source = new File(asset.uri);
      const destination = new File(albumDir, `${index + 1}-${safeName}`);
      await source.copy(destination, { overwrite: true });
      audioUri = destination.uri;
    }

    tracks.push({
      id: `${albumId}-track-${index}`,
      title: titleFromFilename(asset.name),
      artist: "Local file",
      album: "Imported music",
      // expo-audio replaces this with the actual duration as soon as the track loads.
      duration: 0,
      audioUri,
      trackNumber: index + 1,
      downloadedAt,
    });
  }

  const album: Album = {
    id: albumId,
    title: assets.length === 1 ? titleFromFilename(assets[0].name) : "Imported music",
    artist: "On this device",
    trackCount: tracks.length,
    totalDuration: 0,
    downloadedAt,
    tracks,
  };
  useMusicStore.getState().addAlbum(album);
  return album;
}
