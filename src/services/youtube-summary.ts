import { Innertube } from "youtubei.js";
import { setupPlatformEvaluator } from "./evaluator";
import { getDocumentAsync } from "expo-document-picker";
import * as FileSystem from "expo-file-system";

export interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

export interface YoutubeSummary {
  videoId: string;
  title: string;
  author: string;
  duration: number;
  segments: TranscriptSegment[];
  transcriptText: string;
}

function parseXmlTranscript(xml: string): TranscriptSegment[] {
  const segments: TranscriptSegment[] = [];
  const regex = /<text start="([\d.]+)" dur="([\d.]+)"[^>]*>([\s\S]*?)<\/text>/g;
  let match;
  while ((match = regex.exec(xml)) !== null) {
    segments.push({
      start: parseFloat(match[1]),
      duration: parseFloat(match[2]),
      text: match[3]
        .replace(/&amp;#39;/g, "'")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/\[.*?\]/g, "")
        .trim(),
    });
  }
  return segments;
}

function formatTimestamp(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export interface VideoInfo {
  title: string;
  author: string;
  channelUrl: string;
  videoId: string;
  duration: number;
  shortDescription?: string;
  thumbnailUrl?: string;
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^([a-zA-Z0-9_-]{11})$/,
  ];
  for (const p of patterns) {
    const m = url.match(p);
    if (m) return m[1];
  }
  return null;
}

let _ytube: Innertube | null = null;

async function getYtTube(): Promise<Innertube> {
  if (!_ytube) {
    setupPlatformEvaluator();
    _ytube = await Innertube.create({
      lang: "en",
      location: "US",
      retrieve_player: true,
    });
  }
  return _ytube;
}

export async function getVideoInfo(videoId: string): Promise<VideoInfo> {
  const tube = await getYtTube();
  const info = await tube.getInfo(videoId);
  const details = info.basic_info;
  const thumbs = details.thumbnail ?? [];
  const bestThumb = thumbs.reduce((best, t) =>
    t.width > (best?.width ?? 0) ? t : best, thumbs[0]);
  return {
    title: details.title || "Unknown",
    author: details.author || details.channel?.name || "Unknown",
    channelUrl: details.channel?.url || "",
    videoId,
    duration: details.duration || 0,
    shortDescription: details.short_description,
    thumbnailUrl: bestThumb?.url,
  };
}

export async function getTranscript(videoId: string): Promise<{ segments: TranscriptSegment[]; videoInfo: VideoInfo }> {
  const tube = await getYtTube();
  const info = await tube.getInfo(videoId);
  const details = info.basic_info;
  const thumbs = details.thumbnail ?? [];
  const bestThumb = thumbs.reduce((best, t) =>
    t.width > (best?.width ?? 0) ? t : best, thumbs[0]);
  const videoInfo: VideoInfo = {
    title: details.title || "Unknown",
    author: details.author || details.channel?.name || "Unknown",
    channelUrl: details.channel?.url || "",
    videoId,
    duration: details.duration || 0,
    shortDescription: details.short_description,
    thumbnailUrl: bestThumb?.url,
  };

  if (!info.captions?.caption_tracks?.length) {
    throw new Error("No captions available for this video");
  }

  const track = info.captions.caption_tracks.find((t: any) => t.language_code === "en" && !t.kind)
    || info.captions.caption_tracks.find((t: any) => t.language_code === "en")
    || info.captions.caption_tracks[0];

  const url = (track as any).base_url;
  if (!url) throw new Error("Caption track has no URL");

  const resp = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!resp.ok) throw new Error("Failed to fetch captions");

  const xml = await resp.text();
  const segments = parseXmlTranscript(xml);

  return { segments, videoInfo };
}

export function buildSummaryText(videoInfo: VideoInfo, segments: TranscriptSegment[]): string {
  const lines: string[] = [];

  lines.push(`\u{1F3AC} Video Summary`);
  lines.push(`\u{1F4F9} ${videoInfo.title}`);
  lines.push(`\u{1F4E1} ${videoInfo.author}`);
  lines.push(`\u{1F517} https://youtube.com/watch?v=${videoInfo.videoId}`);
  if (videoInfo.duration > 0) {
    lines.push(`\u{23F1}\uFE0F Duration: ${formatTimestamp(videoInfo.duration)}`);
  }
  lines.push("");

  if (videoInfo.shortDescription) {
    lines.push(videoInfo.shortDescription);
    lines.push("");
  }

  lines.push(`\u{1F4CB} Chapter Summary`);
  for (const seg of segments) {
    if (!seg.text) continue;
    const start = formatTimestamp(seg.start);
    const end = formatTimestamp(seg.start + seg.duration);
    lines.push(`${start} - ${end} ${seg.text}`);
  }

  return lines.join("\n");
}

export async function downloadThumbnail(videoInfo: VideoInfo): Promise<string | null> {
  if (!videoInfo.thumbnailUrl) return null;
  try {
    const ext = videoInfo.thumbnailUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] || "jpg";
    const dest = `${FileSystem.cacheDirectory}yt-thumb-${videoInfo.videoId}.${ext}`;
    const result = await FileSystem.downloadAsync(videoInfo.thumbnailUrl, dest);
    return result.uri;
  } catch {
    return null;
  }
}
