import { create } from "zustand";
import { musicStorage } from "./mmkv";

export interface Track {
  id: string;
  title: string;
  artist: string;
  album: string;
  duration: number;
  audioUri: string;
  coverUri?: string;
  lyrics?: string;
  syncedLyrics?: string;
  plainLyrics?: string;
  trackNumber: number;
  downloadedAt: string;
}

export interface Album {
  id: string;
  title: string;
  artist: string;
  coverUri?: string;
  trackCount: number;
  totalDuration: number;
  downloadedAt: string;
  tracks: Track[];
}

export interface DownloadItem {
  id: string;
  title: string;
  artist: string;
  progress: number;
  status: "downloading" | "completed" | "error";
  error?: string;
}

interface MusicState {
  albums: Album[];
  currentAlbum: Album | null;
  currentTrackIndex: number;
  isPlaying: boolean;
  position: number;
  duration: number;
  downloads: DownloadItem[];

  loadAlbums: () => void;
  addAlbum: (album: Album) => void;
  removeAlbum: (albumId: string) => void;
  getAlbum: (albumId: string) => Album | undefined;
  setCurrentAlbum: (album: Album | null, trackIndex?: number) => void;
  setCurrentTrackIndex: (index: number) => void;
  setPlaying: (playing: boolean) => void;
  setPosition: (position: number) => void;
  setDuration: (duration: number) => void;
  playNext: () => void;
  playPrevious: () => void;
  clearAll: () => void;
  addDownload: (item: DownloadItem) => void;
  updateDownload: (id: string, update: Partial<DownloadItem>) => void;
  removeDownload: (id: string) => void;
}

export const useMusicStore = create<MusicState>((set, get) => ({
  albums: [],
  currentAlbum: null,
  currentTrackIndex: 0,
  isPlaying: false,
  position: 0,
  duration: 0,
  downloads: [],

  loadAlbums: () => {
    const keys = musicStorage.getAllKeys();
    const albums: Album[] = keys
      .map((key) => {
        const data = musicStorage.getString(key);
        return data ? JSON.parse(data) : null;
      })
      .filter(Boolean) as Album[];
    albums.sort((a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime());
    set({ albums });
  },

  addAlbum: (album) => {
    musicStorage.set(album.id, JSON.stringify(album));
    set((state) => ({
      // A download is persisted after every playable track. Replace the in-progress
      // album instead of adding another copy each time.
      albums: [album, ...state.albums.filter((item) => item.id !== album.id)].sort(
        (a, b) => new Date(b.downloadedAt).getTime() - new Date(a.downloadedAt).getTime()
      ),
    }));
  },

  removeAlbum: (albumId) => {
    musicStorage.remove(albumId);
    set((state) => ({ albums: state.albums.filter((a) => a.id !== albumId) }));
  },

  getAlbum: (albumId) => {
    return get().albums.find((a) => a.id === albumId);
  },

  setCurrentAlbum: (album, trackIndex = 0) => {
    set({ currentAlbum: album, currentTrackIndex: trackIndex, position: 0 });
  },

  setCurrentTrackIndex: (index) => {
    set({ currentTrackIndex: index, position: 0 });
  },

  setPlaying: (playing) => {
    set({ isPlaying: playing });
  },

  setPosition: (position) => {
    set({ position });
  },

  setDuration: (duration) => {
    set({ duration });
  },

  playNext: () => {
    const { currentAlbum, currentTrackIndex } = get();
    if (currentAlbum && currentTrackIndex < currentAlbum.tracks.length - 1) {
      set({ currentTrackIndex: currentTrackIndex + 1, position: 0 });
    }
  },

  playPrevious: () => {
    const { currentTrackIndex } = get();
    if (currentTrackIndex > 0) {
      set({ currentTrackIndex: currentTrackIndex - 1, position: 0 });
    }
  },

  addDownload: (item) => {
    set((state) => ({ downloads: [item, ...state.downloads] }));
  },
  updateDownload: (id, update) => {
    set((state) => ({
      downloads: state.downloads.map((d) => (d.id === id ? { ...d, ...update } : d)),
    }));
  },
  removeDownload: (id) => {
    set((state) => ({ downloads: state.downloads.filter((d) => d.id !== id) }));
  },

  clearAll: () => {
    musicStorage.clearAll();
    set({ albums: [], currentAlbum: null, downloads: [] });
  },
}));
