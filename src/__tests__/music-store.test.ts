import { useMusicStore, type DownloadItem } from "../stores/music-store";

beforeEach(() => {
  useMusicStore.setState({
    albums: [],
    currentAlbum: null,
    currentTrackIndex: 0,
    isPlaying: false,
    position: 0,
    duration: 0,
    downloads: [],
  });
});

describe("useMusicStore", () => {
  // ---- Downloads ----
  describe("download queue", () => {
    it("adds a download", () => {
      useMusicStore.getState().addDownload({
        id: "dl-1", title: "Song A", artist: "Artist A",
        progress: 0, status: "downloading",
      });
      expect(useMusicStore.getState().downloads).toHaveLength(1);
      expect(useMusicStore.getState().downloads[0].title).toBe("Song A");
    });

    it("updates a download", () => {
      useMusicStore.getState().addDownload({
        id: "dl-1", title: "Song A", artist: "Artist A",
        progress: 0, status: "downloading",
      });
      useMusicStore.getState().updateDownload("dl-1", { progress: 0.5 });
      expect(useMusicStore.getState().downloads[0].progress).toBe(0.5);
    });

    it("removes a download", () => {
      useMusicStore.getState().addDownload({
        id: "dl-1", title: "Song A", artist: "Artist A",
        progress: 0, status: "downloading",
      });
      useMusicStore.getState().removeDownload("dl-1");
      expect(useMusicStore.getState().downloads).toHaveLength(0);
    });

    it("prepends new downloads", () => {
      useMusicStore.getState().addDownload({
        id: "dl-1", title: "Song A", artist: "Artist A",
        progress: 0, status: "downloading",
      });
      useMusicStore.getState().addDownload({
        id: "dl-2", title: "Song B", artist: "Artist B",
        progress: 0, status: "downloading",
      });
      expect(useMusicStore.getState().downloads[0].id).toBe("dl-2");
    });

    it("updates only matching id", () => {
      useMusicStore.getState().addDownload({
        id: "dl-1", title: "Song A", artist: "Artist A",
        progress: 0, status: "downloading",
      });
      useMusicStore.getState().addDownload({
        id: "dl-2", title: "Song B", artist: "Artist B",
        progress: 0, status: "downloading",
      });
      useMusicStore.getState().updateDownload("dl-1", { progress: 0.5, status: "completed" });
      const downloads = useMusicStore.getState().downloads;
      expect(downloads.find((d) => d.id === "dl-1")?.progress).toBe(0.5);
      expect(downloads.find((d) => d.id === "dl-1")?.status).toBe("completed");
      expect(downloads.find((d) => d.id === "dl-2")?.progress).toBe(0);
    });
  });

  // ---- Playback ----
  describe("playback controls", () => {
    it("sets current album and track", () => {
      const album = {
        id: "alb-1", title: "Album 1", artist: "Artist",
        coverUri: "", trackCount: 2, totalDuration: 200,
        downloadedAt: new Date().toISOString(),
        tracks: [
          { id: "t1", title: "Track 1", artist: "A", album: "A1",
            duration: 100, audioUri: "/a.mp3", trackNumber: 1, downloadedAt: "" },
          { id: "t2", title: "Track 2", artist: "A", album: "A1",
            duration: 100, audioUri: "/b.mp3", trackNumber: 2, downloadedAt: "" },
        ],
      };
      useMusicStore.getState().setCurrentAlbum(album, 1);
      const state = useMusicStore.getState();
      expect(state.currentAlbum?.id).toBe("alb-1");
      expect(state.currentTrackIndex).toBe(1);
    });

    it("playNext advances track index", () => {
      const album = {
        id: "alb-1", title: "Album 1", artist: "Artist",
        coverUri: "", trackCount: 2, totalDuration: 200,
        downloadedAt: new Date().toISOString(),
        tracks: [
          { id: "t1", title: "Track 1", artist: "A", album: "A1",
            duration: 100, audioUri: "/a.mp3", trackNumber: 1, downloadedAt: "" },
          { id: "t2", title: "Track 2", artist: "A", album: "A1",
            duration: 100, audioUri: "/b.mp3", trackNumber: 2, downloadedAt: "" },
        ],
      };
      useMusicStore.getState().setCurrentAlbum(album, 0);
      useMusicStore.getState().playNext();
      expect(useMusicStore.getState().currentTrackIndex).toBe(1);
    });

    it("playNext does not wrap around", () => {
      const album = {
        id: "alb-1", title: "Album 1", artist: "Artist",
        coverUri: "", trackCount: 2, totalDuration: 200,
        downloadedAt: new Date().toISOString(),
        tracks: [
          { id: "t1", title: "Track 1", artist: "A", album: "A1",
            duration: 100, audioUri: "/a.mp3", trackNumber: 1, downloadedAt: "" },
          { id: "t2", title: "Track 2", artist: "A", album: "A1",
            duration: 100, audioUri: "/b.mp3", trackNumber: 2, downloadedAt: "" },
        ],
      };
      useMusicStore.getState().setCurrentAlbum(album, 1);
      useMusicStore.getState().playNext();
      expect(useMusicStore.getState().currentTrackIndex).toBe(1);
    });

    it("playPrevious goes back", () => {
      const album = {
        id: "alb-1", title: "Album 1", artist: "Artist",
        coverUri: "", trackCount: 2, totalDuration: 200,
        downloadedAt: new Date().toISOString(),
        tracks: [
          { id: "t1", title: "Track 1", artist: "A", album: "A1",
            duration: 100, audioUri: "/a.mp3", trackNumber: 1, downloadedAt: "" },
          { id: "t2", title: "Track 2", artist: "A", album: "A1",
            duration: 100, audioUri: "/b.mp3", trackNumber: 2, downloadedAt: "" },
        ],
      };
      useMusicStore.getState().setCurrentAlbum(album, 1);
      useMusicStore.getState().playPrevious();
      expect(useMusicStore.getState().currentTrackIndex).toBe(0);
    });

    it("playPrevious does not go below 0", () => {
      useMusicStore.getState().setCurrentAlbum(null, 0);
      useMusicStore.getState().playPrevious();
      expect(useMusicStore.getState().currentTrackIndex).toBe(0);
    });
  });

  // ---- Album CRUD ----
  describe("album management", () => {
    it("loadAlbums returns empty initially", () => {
      useMusicStore.getState().loadAlbums();
      expect(useMusicStore.getState().albums).toEqual([]);
    });

    it("addAlbum and getAlbum", () => {
      const album = {
        id: "alb-1", title: "Test Album", artist: "Test Artist",
        coverUri: "", trackCount: 0, totalDuration: 0,
        downloadedAt: new Date().toISOString(), tracks: [],
      };
      useMusicStore.getState().addAlbum(album);
      expect(useMusicStore.getState().albums).toHaveLength(1);
      const found = useMusicStore.getState().getAlbum("alb-1");
      expect(found?.title).toBe("Test Album");
    });

    it("replaces album with same id", () => {
      const album1 = {
        id: "alb-1", title: "First", artist: "A",
        coverUri: "", trackCount: 0, totalDuration: 0,
        downloadedAt: new Date().toISOString(), tracks: [],
      };
      const album2 = {
        id: "alb-1", title: "Second", artist: "A",
        coverUri: "", trackCount: 1, totalDuration: 100,
        downloadedAt: new Date().toISOString(), tracks: [
          { id: "t1", title: "T1", artist: "A", album: "A",
            duration: 100, audioUri: "/a.mp3", trackNumber: 1, downloadedAt: "" },
        ],
      };
      useMusicStore.getState().addAlbum(album1);
      useMusicStore.getState().addAlbum(album2);
      expect(useMusicStore.getState().albums).toHaveLength(1);
      expect(useMusicStore.getState().albums[0].title).toBe("Second");
    });

    it("removeAlbum removes it", () => {
      const album = {
        id: "alb-1", title: "X", artist: "Y",
        coverUri: "", trackCount: 0, totalDuration: 0,
        downloadedAt: new Date().toISOString(), tracks: [],
      };
      useMusicStore.getState().addAlbum(album);
      useMusicStore.getState().removeAlbum("alb-1");
      expect(useMusicStore.getState().albums).toHaveLength(0);
    });
  });
});
