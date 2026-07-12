import { createAudioPlayer, setAudioModeAsync } from "expo-audio";
import type { AudioPlayer, AudioStatus } from "expo-audio";
import { useMusicStore } from "@/stores/music-store";

class AudioPlayerService {
  private player: AudioPlayer | null = null;
  private initialized = false;
  private statusSubscription: { remove: () => void } | null = null;

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
    await this.initialize();
    this.statusSubscription?.remove();
    this.player?.remove();

    const player = createAudioPlayer({ uri: audioUri }, { updateInterval: 250 });
    this.player = player;
    player.setActiveForLockScreen(true, {
      title: metadata.title,
      artist: metadata.artist,
      albumTitle: metadata.album,
      artworkUrl: metadata.artworkUrl,
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
  }

  private async playFollowingTrack() {
    const store = useMusicStore.getState();
    const album = store.currentAlbum;
    if (!album || store.currentTrackIndex >= album.tracks.length - 1) {
      store.setPlaying(false);
      return;
    }

    store.playNext();
    const nextAlbum = useMusicStore.getState().currentAlbum;
    const nextTrack = nextAlbum?.tracks[useMusicStore.getState().currentTrackIndex];
    if (!nextAlbum || !nextTrack) return;

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
  setRate(rate: number) { if (this.player) this.player.playbackRate = rate; }
  async unload() {
    this.statusSubscription?.remove();
    this.statusSubscription = null;
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

  const loadCurrentTrack = async () => {
    const album = useMusicStore.getState().currentAlbum;
    const index = useMusicStore.getState().currentTrackIndex;
    const track = album?.tracks[index];
    if (!album || !track) return;
    await audioPlayer.loadTrack(track.audioUri, {
      title: track.title,
      artist: track.artist,
      album: album.title,
      artworkUrl: track.coverUri ?? album.coverUri,
    });
  };

  const play = async () => { audioPlayer.play(); setPlaying(true); };
  const pause = async () => { audioPlayer.pause(); setPlaying(false); };
  const seek = async (position: number) => { await audioPlayer.seekTo(position); setPosition(position); };
  const next = async () => {
    playNext();
    await loadCurrentTrack();
    await play();
  };
  const previous = async () => {
    playPrevious();
    await loadCurrentTrack();
    await play();
  };

  return {
    initialize: () => audioPlayer.initialize(),
    loadCurrentTrack,
    play,
    pause,
    seek,
    next,
    previous,
    setPlaybackRate: (rate: number) => audioPlayer.setRate(rate),
    currentTrack: currentAlbum?.tracks[currentTrackIndex],
  };
}
