declare module "react-native-ytdl" {
  interface VideoFormat {
    itag: number;
    url?: string;
    mimeType?: string;
    quality?: string;
    contentLength?: string;
    audioBitrate?: number;
    hasAudio: boolean;
    hasVideo: boolean;
    container?: string;
  }

  interface VideoInfo {
    videoDetails: {
      videoId: string;
      title: string;
      lengthSeconds: string;
      thumbnails: { url: string }[];
      author?: { name: string };
    };
    formats: VideoFormat[];
  }

  interface YtdlOptions {
    quality?: string | string[];
    filter?: "audioandvideo" | "videoandaudio" | "video" | "videoonly" | "audio" | "audioonly";
  }

  function ytdl(link: string, options?: YtdlOptions): Promise<any>;

  namespace ytdl {
    function getInfo(link: string): Promise<VideoInfo>;
    function getBasicInfo(link: string): Promise<VideoInfo>;
    function chooseFormat(formats: VideoFormat[], options: { quality?: string | string[]; filter?: string }): VideoFormat | undefined;
    function filterFormats(formats: VideoFormat[], filter: string): VideoFormat[];
    function validateURL(url: string): boolean;
    function getURLVideoID(url: string): string;
    function getVideoID(url: string): string;
  }

  export default ytdl;
}
