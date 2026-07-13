import { Directory, File, Paths } from "expo-file-system";
import { Innertube } from "youtubei.js";
import { setupPlatformEvaluator } from "./evaluator";

let innertube: Innertube | null = null;

async function getInnertube(): Promise<Innertube> {
  if (!innertube) {
    setupPlatformEvaluator();
    console.log("[download] creating Innertube...");
    innertube = await Innertube.create({
      lang: "en",
      location: "US",
      retrieve_player: true,
    });
    console.log("[download] Innertube created");
  }
  return innertube;
}

function id(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface SearchResult {
  videoId: string;
  title: string;
  artist: string;
  thumbnail: string;
  duration: number;
}

export interface AlbumResult {
  browseId: string;
  title: string;
  artist: string;
  thumbnail: string;
  year?: string;
  trackCount?: number;
}

export interface PlaylistResult {
  browseId: string;
  title: string;
  thumbnail: string;
  trackCount?: number;
}

export interface SearchResponse {
  songs: SearchResult[];
  albums: AlbumResult[];
  playlists: PlaylistResult[];
}

export interface DownloadProgress {
  trackIndex: number;
  trackTitle: string;
  trackArtist: string;
  trackNumber: number;
  totalTracks: number;
  progress: number;
  albumTitle: string;
  albumArtist: string;
  status: "searching" | "downloading-audio" | "downloading-cover" | "fetching-lyrics" | "completed" | "error";
  error?: string;
}

export interface TrackData {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  audioUri: string;
  coverUri?: string;
  lyrics?: string;
  trackNumber: number;
  downloadedAt: string;
}

export interface DownloadConfig {
  onProgress?: (progress: DownloadProgress) => void;
  onComplete?: (track: TrackData) => void;
  onError?: (error: Error, trackTitle: string) => void;
}

function extractArtist(item: any): string {
  return item.artists?.[0]?.name || item.author?.name || "";
}

function extractThumbnail(item: any): string {
  const thumbs = item.thumbnails || item.thumbnail;
  if (Array.isArray(thumbs) && thumbs.length > 0) {
    return thumbs[thumbs.length - 1]?.url || thumbs[0]?.url || "";
  }
  return "";
}

export async function searchTracks(query: string): Promise<SearchResponse> {
  let tube: Innertube;
  try {
    tube = await getInnertube();
  } catch (e) {
    console.error("[search] getInnertube failed:", e);
    throw e;
  }

  let songSearch: any, albumSearch: any, playlistSearch: any;
  try {
    [songSearch, albumSearch, playlistSearch] = await Promise.all([
      tube.music.search(query, { type: "song" } as any),
      tube.music.search(query, { type: "album" } as any),
      tube.music.search(query, { type: "playlist" } as any),
    ]);
  } catch (e) {
    console.error("[search] search failed:", e);
    throw e;
  }

  const songs: SearchResult[] = [];
  const songShelf = songSearch.songs;
  if (songShelf) {
    for (const item of (songShelf.contents || []).slice(0, 10)) {
      const vid = item.id;
      if (!vid) continue;
      songs.push({
        videoId: vid,
        title: item.title || "",
        artist: extractArtist(item),
        thumbnail: extractThumbnail(item),
        duration: item.duration?.seconds || 0,
      });
    }
  }

  const albums: AlbumResult[] = [];
  const albumShelf = albumSearch.albums;
  if (albumShelf) {
    for (const item of (albumShelf.contents || []).slice(0, 10)) {
      const browseId = item.endpoint?.payload?.browseId || "";
      if (!browseId) continue;
      albums.push({
        browseId,
        title: item.title || "",
        artist: extractArtist(item),
        thumbnail: extractThumbnail(item),
        year: item.year,
        trackCount: item.item_count ? parseInt(item.item_count, 10) : undefined,
      });
    }
  }

  const playlists: PlaylistResult[] = [];
  const playlistShelf = playlistSearch.playlists;
  if (playlistShelf) {
    for (const item of (playlistShelf.contents || []).slice(0, 10)) {
      const browseId = item.endpoint?.payload?.browseId || "";
      if (!browseId) continue;
      playlists.push({
        browseId,
        title: item.title || "",
        thumbnail: extractThumbnail(item),
        trackCount: item.item_count ? parseInt(item.item_count, 10) : undefined,
      });
    }
  }

  return { songs, albums, playlists };
}

export async function getAlbumTracks(browseId: string): Promise<{ title: string; artist: string; tracks: SearchResult[] }> {
  const tube = await getInnertube();
  const album = await tube.music.getAlbum(browseId);

  const albumTitle = (album.header as any)?.title?.toString() || "";
  const albumArtist = (album.header as any)?.author?.name || (album.header as any)?.strapline_text_one?.toString() || "";

  const tracks: SearchResult[] = [];
  for (const item of album.contents || []) {
    const vid = item.id;
    if (!vid) continue;
    tracks.push({
      videoId: vid,
      title: item.title || "",
      artist: extractArtist(item) || albumArtist,
      thumbnail: extractThumbnail(item),
      duration: item.duration?.seconds || 0,
    });
  }

  return { title: albumTitle, artist: albumArtist, tracks };
}

export async function getPlaylistTracks(browseId: string): Promise<{ title: string; tracks: SearchResult[] }> {
  const tube = await getInnertube();
  const playlist = await tube.music.getPlaylist(browseId);

  const playlistTitle = (playlist.header as any)?.title?.toString() || "";
  const tracks: SearchResult[] = [];
  for (const item of (playlist.items || [])) {
    if ((item as any).type === "MusicResponsiveListItem") {
      const li = item as any;
      const vid = li.id;
      if (!vid) continue;
      tracks.push({
        videoId: vid,
        title: li.title || "",
        artist: extractArtist(li),
        thumbnail: extractThumbnail(li),
        duration: li.duration?.seconds || 0,
      });
    }
  }

  return { title: playlistTitle, tracks };
}

async function downloadSingleTrack(
  track: SearchResult,
  albumDir: Directory,
  albumTitle: string,
  albumArtist: string,
  trackNumber: number,
  totalTracks: number,
  config: DownloadConfig
): Promise<TrackData> {
  const { onProgress, onError } = config;

  onProgress?.({
    trackIndex: trackNumber - 1, trackTitle: track.title, trackArtist: track.artist,
    trackNumber, totalTracks,
    progress: 0, albumTitle, albumArtist, status: "searching",
  });

  const tube = await getInnertube();
  const player = tube.session.player;

  let info;
  try {
    info = await tube.music.getInfo(track.videoId);
  } catch (e) {
    const err = new Error(`Could not get track info: ${(e as Error).message}`);
    onError?.(err, track.title);
    throw err;
  }

  const details = info.basic_info;
  const title = details.title || track.title;
  const artist = details.author || details.channel?.name || track.artist || albumArtist;
  const duration = details.duration || track.duration;
  const thumb = details.thumbnail?.[0]?.url || track.thumbnail;

  let formats = info.streaming_data?.formats || [];
  if (formats.length === 0) {
    const err = new Error("No streaming formats returned from YouTube (may need login or different client)");
    onError?.(err, title);
    throw err;
  }

  let audioFormat = info.chooseFormat({ type: "audio", quality: "lowest", format: "mp4" }) || formats[formats.length - 1];

  let audioUrl: string | undefined;

  if (audioFormat.url && audioFormat.url.startsWith("http")) {
    audioUrl = audioFormat.url;
  }

  if (!audioUrl) {
    try {
      audioUrl = await audioFormat.decipher(player);
    } catch (e) {
      console.warn("[download] decipher failed:", (e as Error).message);
    }
  }

  if (!audioUrl) {
    for (const f of formats) {
      if (f.url && f.url.startsWith("http")) {
        audioUrl = f.url;
        break;
      }
    }
  }

  if (!audioUrl) {
    const err = new Error("Could not obtain audio URL (all decipher attempts failed)");
    onError?.(err, title);
    throw err;
  }

  const ext = audioFormat.mime_type?.includes("webm") ? "webm" : "m4a";
  const trackId = `yt-${track.videoId}`;
  const audioFile = new File(albumDir, `${trackId}.${ext}`);

  onProgress?.({
    trackIndex: trackNumber - 1, trackTitle: title, trackArtist: artist,
    trackNumber, totalTracks,
    progress: 0, albumTitle, albumArtist, status: "downloading-audio",
  });

  await File.downloadFileAsync(audioUrl, audioFile, {
    idempotent: true,
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      Referer: "https://www.youtube.com",
    },
    onProgress: (p) => {
      const percent = p.totalBytes > 0 ? p.bytesWritten / p.totalBytes : 0;
      onProgress?.({
        trackIndex: trackNumber - 1, trackTitle: title, trackArtist: artist,
        trackNumber, totalTracks,
        progress: percent, albumTitle, albumArtist, status: "downloading-audio",
      });
    },
  });

  let coverUri: string | undefined;
  if (thumb) {
    try {
      const coverFile = new File(albumDir, `${trackId}_cover.jpg`);
      await File.downloadFileAsync(thumb, coverFile, { idempotent: true });
      coverUri = coverFile.uri;
    } catch {
      coverUri = thumb;
    }
  }

  let lyrics: string | undefined;
  try {
    const cleanTitle = title.replace(/\(.*?\)|\[.*?\]/g, "").trim();
    const res = await fetch(
      `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(cleanTitle)}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data.lyrics?.length > 20) lyrics = data.lyrics;
    }
  } catch {
  }

  return {
    id: trackId,
    title,
    artist,
    album: albumTitle,
    duration,
    audioUri: audioFile.uri,
    coverUri,
    lyrics,
    trackNumber,
    downloadedAt: new Date().toISOString(),
  };
}

export async function downloadTrack(
  track: SearchResult,
  config: DownloadConfig
): Promise<TrackData> {
  const { onComplete, onError } = config;
  const albumDir = new Directory(Paths.document, "Music", `dl-${id()}`);
  albumDir.create({ idempotent: true, intermediates: true });

  try {
    const data = await downloadSingleTrack(track, albumDir, track.title, track.artist, 1, 1, config);
    onComplete?.(data);
    return data;
  } catch (e) {
    if (onError) throw e;
    throw e;
  }
}

export async function downloadAlbum(
  browseId: string,
  config: DownloadConfig
): Promise<TrackData[]> {
  const { title, artist, tracks } = await getAlbumTracks(browseId);
  if (tracks.length === 0) throw new Error("No tracks found");

  const albumDir = new Directory(Paths.document, "Music", `dl-${id()}`);
  albumDir.create({ idempotent: true, intermediates: true });

  const results: TrackData[] = [];
  const batchSize = 3;
  for (let start = 0; start < tracks.length; start += batchSize) {
    const batch = tracks.slice(start, start + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((track, bi) => {
        const i = start + bi;
        return downloadSingleTrack(track, albumDir, title, artist, i + 1, tracks.length, config);
      })
    );
    for (const r of batchResults) {
      if (r.status === "fulfilled") {
        results.push(r.value);
        config.onComplete?.(r.value);
      }
    }
  }
  return results;
}

export async function downloadPlaylist(
  browseId: string,
  config: DownloadConfig
): Promise<TrackData[]> {
  const { title, tracks } = await getPlaylistTracks(browseId);
  if (tracks.length === 0) throw new Error("No tracks found");

  const albumDir = new Directory(Paths.document, "Music", `dl-${id()}`);
  albumDir.create({ idempotent: true, intermediates: true });

  const results: TrackData[] = [];
  const batchSize = 3;
  for (let start = 0; start < tracks.length; start += batchSize) {
    const batch = tracks.slice(start, start + batchSize);
    const batchResults = await Promise.allSettled(
      batch.map((track, bi) => {
        const i = start + bi;
        return downloadSingleTrack(track, albumDir, title, "", i + 1, tracks.length, config);
      })
    );
    for (const r of batchResults) {
      if (r.status === "fulfilled") {
        results.push(r.value);
        config.onComplete?.(r.value);
      }
    }
  }
  return results;
}
