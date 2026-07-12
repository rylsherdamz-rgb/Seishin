import { Platform } from "react-native";
import { Directory, File, Paths } from "expo-file-system";
import { useMusicStore } from "@/stores/music-store";
import { fetchLyrics, searchLyrics } from "@/services/lyrics";

function uuidv4(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export interface DownloadProgress {
  trackIndex: number;
  trackTitle: string;
  totalTracks: number;
  progress: number;
  status: "searching" | "downloading" | "converting" | "completed" | "error";
}

export interface DownloadConfig {
  spotifyClientId?: string;
  spotifyClientSecret?: string;
  downloadDir?: string;
  onProgress?: (progress: DownloadProgress) => void;
  onTrackComplete?: (track: any) => void;
  onError?: (error: Error, trackTitle: string) => void;
}

function extractSpotifyId(url: string, type: "playlist" | "album"): string | null {
  const patterns = {
    playlist: /(?:playlist\/|playlist:|spotify:playlist:)([a-zA-Z0-9]+)/,
    album: /(?:album\/|album:|spotify:album:)([a-zA-Z0-9]+)/,
  };
  const match = url.match(patterns[type]);
  return match ? match[1] : null;
}

interface EmbedTrack {
  title: string;
  subtitle: string;
  duration: number;
  audioPreview?: { url?: string };
  uid?: string;
}

interface EmbedEntity {
  name: string;
  title: string;
  subtitle: string;
  visualIdentity?: { image?: { url: string; maxHeight?: number; maxWidth?: number }[] };
  coverArt?: { image?: { url: string }[] } | any;
  trackList?: EmbedTrack[];
}

function findEntity(node: any): EmbedEntity | null {
  if (node && typeof node === "object") {
    if (Array.isArray(node.trackList) && node.trackList.length) return node as EmbedEntity;
    for (const value of Object.values(node)) {
      const found = findEntity(value);
      if (found) return found;
    }
  }
  return null;
}

async function fetchSpotifyEmbed(url: string): Promise<{ type: "playlist" | "album"; data: EmbedEntity } | null> {
  const id = extractSpotifyId(url, "album") || extractSpotifyId(url, "playlist");
  if (!id) return null;
  const type = extractSpotifyId(url, "album") ? "album" : "playlist";
  const embedUrl = `https://open.spotify.com/embed/${type}/${id}`;
  const res = await fetch(embedUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
  if (!res.ok) return null;
  const html = await res.text();
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;
  const nextData = JSON.parse(match[1]);
  const entity = findEntity(nextData);
  if (!entity || !entity.trackList) return null;
  return { type, data: entity };
}

function pickCoverUrl(entity: EmbedEntity): string | undefined {
  const candidates: { url: string; size: number }[] = [];
  const push = (url?: string, size = 0) => {
    if (url && url.startsWith("http")) candidates.push({ url, size });
  };
  if (entity.visualIdentity?.image?.length) {
    for (const img of entity.visualIdentity.image) push(img.url, img.maxWidth || 0);
  }
  if (entity.coverArt?.image?.length) {
    for (const img of entity.coverArt.image) push(img.url);
  }
  if (!candidates.length) return undefined;
  candidates.sort((a, b) => b.size - a.size);
  return candidates[0].url;
}

async function downloadFile(url: string, file: File): Promise<string> {
  if (Platform.OS === "web") {
    const res = await fetch(url);
    return URL.createObjectURL(await res.blob());
  }
  const result = await File.downloadFileAsync(url, file, { idempotent: true });
  return result.uri;
}

export async function downloadSpotifyUrl(
  url: string,
  config: DownloadConfig
): Promise<{ albumId: string; trackCount: number; sourceTrackCount: number; unavailableTrackCount: number }> {
  const spotifyData = await fetchSpotifyEmbed(url);
  if (!spotifyData) {
    throw new Error("Invalid Spotify URL or unsupported content");
  }

  const { type, data: entity } = spotifyData;
  const albumTitle = entity.title || entity.name || "Unknown Album";
  const albumArtist = entity.subtitle || "Unknown Artist";

  const albumId = `album-${uuidv4()}`;
  const albumDir = config.downloadDir
    ? new Directory(config.downloadDir, albumId)
    : new Directory(Paths.document, "Music", albumId);
  albumDir.create({ idempotent: true, intermediates: true });

  let coverUri: string | undefined;
  const coverUrl = pickCoverUrl(entity);
  if (coverUrl) {
    try {
      coverUri = await downloadFile(coverUrl, new File(albumDir, "cover.jpg"));
    } catch {
      coverUri = coverUrl;
    }
  }

  const processedTracks: any[] = [];
  let unavailableTrackCount = 0;
  const tracks = entity.trackList || [];
  const downloadedAt = new Date().toISOString();

  const saveAlbum = () => {
    const totalDuration = processedTracks.reduce((sum, track) => sum + (track.duration || 0), 0);
    useMusicStore.getState().addAlbum({
      id: albumId,
      title: albumTitle,
      artist: albumArtist,
      coverUri,
      trackCount: processedTracks.length,
      totalDuration,
      downloadedAt,
      tracks: [...processedTracks],
    });
  };

  for (let i = 0; i < tracks.length; i++) {
    const track = tracks[i];
    const artistName = track.subtitle || albumArtist;

    config.onProgress?.({
      trackIndex: i,
      trackTitle: track.title,
      totalTracks: tracks.length,
      progress: 0,
      status: "searching",
    });

    let audioUri: string | undefined;
    const previewUrl = track.audioPreview?.url;
    if (previewUrl) {
      try {
        audioUri = await downloadFile(
          previewUrl,
          new File(albumDir, `${(track.uid || `track-${i}`).replace(/[^a-zA-Z0-9_-]/g, "_")}.mp3`)
        );
      } catch {
        // Keeping the preview URL still gives the player a chance to stream it.
        audioUri = previewUrl;
      }
    }

    config.onProgress?.({
      trackIndex: i,
      trackTitle: track.title,
      totalTracks: tracks.length,
      progress: audioUri ? 100 : 0,
      status: audioUri ? "completed" : "error",
    });

    const lyrics = (await fetchLyrics(artistName, track.title)) || (await searchLyrics(artistName, track.title));

    if (!audioUri) {
      unavailableTrackCount += 1;
      config.onError?.(new Error("No authorized preview is available for this track"), track.title);
      continue;
    }

    const processedTrack = {
      id: track.uid || `track-${i}`,
      title: track.title,
      artist: artistName,
      album: albumTitle,
      duration: (track.duration || 0) / 1000,
      audioUri,
      coverUri,
      lyrics: lyrics?.syncedLyrics || lyrics?.plainLyrics,
      syncedLyrics: lyrics?.syncedLyrics,
      plainLyrics: lyrics?.plainLyrics,
      trackNumber: i + 1,
      downloadedAt: new Date().toISOString(),
    };

    processedTracks.push(processedTrack);
    // Persist immediately. If a later preview fails or the screen is closed, the
    // tracks that were actually saved remain visible and playable in Music.
    saveAlbum();
    config.onTrackComplete?.(processedTrack);

  }

  if (!processedTracks.length) {
    throw new Error("Spotify did not provide playable previews for any tracks in this selection.");
  }

  return {
    albumId,
    trackCount: processedTracks.length,
    sourceTrackCount: tracks.length,
    unavailableTrackCount,
  };
}

export function isValidSpotifyUrl(url: string): boolean {
  return /open\.spotify\.com\/(playlist|album)\//.test(url) || /spotify:(playlist|album):/.test(url);
}

export function getSpotifyType(url: string): "playlist" | "album" | null {
  if (url.includes("/playlist/") || url.includes("spotify:playlist:")) return "playlist";
  if (url.includes("/album/") || url.includes("spotify:album:")) return "album";
  return null;
}
