import { useCallback, useMemo } from "react";
import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer, AudioStatus } from "expo-audio";
import { useMusicStore } from "@/stores/music-store";

class AudioPlayerService {
  private player: AudioPlayer | null = null;
  private initialized = false;
  private statusSubscription: { remove: () => void } | null = null;
  private skipNextSub: { remove: () => void } | null = null;
  private skipPrevSub: { remove: () => void } | null = null;
  private loadedTrackUri: string | null = null;

  forceReload() { this.loadedTrackUri = null; }

  async initialize() {
    if (this.initialized) return;
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: "doNotMix",
    });
    this.initialized = true;
  }

  async loadTrack(audioUri: string, metadata: { title: string; artist: string; album: string; artworkUrl?: string }) {
    if (this.loadedTrackUri === audioUri && this.player) {
      return;
    }
    await this.initialize();
    this.loadedTrackUri = audioUri;

    if (this.player) {
      this.player.replace({ uri: audioUri });
      this.player.setActiveForLockScreen(true, {
        title: metadata.title,
        artist: metadata.artist,
        albumTitle: metadata.album,
        artworkUrl: metadata.artworkUrl,
      }, {
        showSkipNext: true,
        showSkipPrevious: true,
      });
      return;
    }

    const player = createAudioPlayer({ uri: audioUri }, { updateInterval: 250 });
    this.player = player;
    player.setActiveForLockScreen(true, {
      title: metadata.title,
      artist: metadata.artist,
      albumTitle: metadata.album,
      artworkUrl: metadata.artworkUrl,
    }, {
      showSkipNext: true,
      showSkipPrevious: true,
    });

    this.statusSubscription = player.addListener("playbackStatusUpdate", (status: AudioStatus) => {
      const store = useMusicStore.getState();
      store.setPosition(status.currentTime * 1000);
      store.setDuration(status.duration * 1000);
      store.setPlaying(status.playing);
      if (status.didJustFinish) {
        void this.playFollowingTrack();
      }
      if (status.error) console.warn("Audio playback error:", status.error);
    });

    this.skipNextSub = player.addListener("skipToNext", () => {
      const store = useMusicStore.getState();
      const album = store.currentAlbum;
      if (album && store.currentTrackIndex < album.tracks.length - 1) {
        void this.loadTrackFromIndex(store.currentTrackIndex + 1);
      }
    });

    this.skipPrevSub = player.addListener("skipToPrevious", () => {
      const store = useMusicStore.getState();
      if (store.currentTrackIndex > 0) {
        void this.loadTrackFromIndex(store.currentTrackIndex - 1);
      }
    });
  }

  private async playFollowingTrack() {
    const store = useMusicStore.getState();
    const album = store.currentAlbum;
    if (!album) { store.setPlaying(false); return; }

    if (store.repeat === "one") {
      store.setPosition(0);
      this.seekTo(0);
      this.play();
      return;
    }

    if (store.shuffle) {
      const next = Math.floor(Math.random() * album.tracks.length);
      store.setCurrentTrackIndex(next);
    } else {
      if (store.currentTrackIndex >= album.tracks.length - 1) {
        if (store.repeat === "all") {
          store.setCurrentTrackIndex(0);
        } else {
          store.setPlaying(false);
          return;
        }
      } else {
        store.playNext();
      }
    }

    const state = useMusicStore.getState();
    const nextAlbum = state.currentAlbum;
    const nextTrack = nextAlbum?.tracks[state.currentTrackIndex];
    if (!nextAlbum || !nextTrack) { store.setPlaying(false); return; }

    await this.loadTrack(nextTrack.audioUri, {
      title: nextTrack.title,
      artist: nextTrack.artist,
      album: nextAlbum.title,
      artworkUrl: nextTrack.coverUri ?? nextAlbum.coverUri,
    });
    this.play();
  }

  play() { this.player?.play(); }
  pause() { this.player?.pause(); }
  seekTo(positionMillis: number) { return this.player?.seekTo(positionMillis / 1000); }
  setRate(rate: number) {
    if (this.player && typeof (this.player as any).setPlaybackRate === "function") {
      (this.player as any).setPlaybackRate(rate);
    } else if (this.player) {
      try { (this.player as any).playbackRate = rate; } catch { console.warn("[audio] setPlaybackRate failed"); }
    }
  }

  private async loadTrackFromIndex(index: number) {
    const store = useMusicStore.getState();
    const album = store.currentAlbum;
    if (!album) return;
    const track = album.tracks[index];
    if (!track) return;
    store.setCurrentTrackIndex(index);
    await this.loadTrack(track.audioUri, {
      title: track.title,
      artist: track.artist,
      album: album.title,
      artworkUrl: track.coverUri ?? album.coverUri,
    });
    this.play();
  }

  async unload() {
    this.statusSubscription?.remove();
    this.statusSubscription = null;
    this.skipNextSub?.remove();
    this.skipNextSub = null;
    this.skipPrevSub?.remove();
    this.skipPrevSub = null;
    this.player?.clearLockScreenControls();
    this.player?.remove();
    this.player = null;
  }
}

export const audioPlayer = new AudioPlayerService();

export function useAudioPlayer() {
  const currentAlbum = useMusicStore((state) => state.currentAlbum);
  const currentTrackIndex = useMusicStore((state) => state.currentTrackIndex);
  const setPlaying = useMusicStore((state) => state.setPlaying);
  const setPosition = useMusicStore((state) => state.setPosition);
  const playNext = useMusicStore((state) => state.playNext);
  const playPrevious = useMusicStore((state) => state.playPrevious);

  const initialize = useCallback(() => audioPlayer.initialize(), []);

  const loadCurrentTrack = useCallback(async (force = false) => {
    const state = useMusicStore.getState();
    const album = state.currentAlbum;
    const index = state.currentTrackIndex;
    const track = album?.tracks[index];
    if (!album || !track) return;
    if (force) audioPlayer.forceReload();
    await audioPlayer.loadTrack(track.audioUri, {
      title: track.title,
      artist: track.artist,
      album: album.title,
      artworkUrl: track.coverUri ?? album.coverUri,
    });
  }, []);

  const play = useCallback(async () => { audioPlayer.play(); setPlaying(true); }, [setPlaying]);

  const pause = useCallback(async () => { audioPlayer.pause(); setPlaying(false); }, [setPlaying]);

  const seek = useCallback(async (position: number) => { await audioPlayer.seekTo(position); setPosition(position); }, [setPosition]);

  const next = useCallback(async () => {
    playNext();
    await loadCurrentTrack();
    await play();
  }, [playNext, loadCurrentTrack, play]);

  const previous = useCallback(async () => {
    playPrevious();
    await loadCurrentTrack();
    await play();
  }, [playPrevious, loadCurrentTrack, play]);

  const setPlaybackRate = useCallback((rate: number) => audioPlayer.setRate(rate), []);

  const currentTrack = useMemo(
    () => currentAlbum?.tracks[currentTrackIndex],
    [currentAlbum, currentTrackIndex]
  );

  return {
    initialize, loadCurrentTrack, play, pause, seek, next, previous,
    setPlaybackRate, currentTrack,
  };
}
