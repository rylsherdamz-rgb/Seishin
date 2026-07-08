import { recognizeText as mlkitRecognize } from "expo-mlkit-ocr";
import { ocrStorage } from "@/stores/mmkv";
import { CalendarEvent } from "@/stores/calendar-store";

interface OcrCache {
  uri: string;
  text: string;
  blocks: { text: string; x: number; y: number }[];
  timestamp: string;
}

export async function recognizeText(uri: string): Promise<string> {
  try {
    const result = await mlkitRecognize(uri);
    return result.text;
  } catch (e) {
    throw new Error(`OCR failed: ${e}`);
  }
}

export function cacheOcrResult(uri: string, text: string, blocks: any[]) {
  const cache: OcrCache = { uri, text, blocks, timestamp: new Date().toISOString() };
  const history = getOcrHistory();
  history.unshift(cache);
  ocrStorage.set("history", JSON.stringify(history.slice(0, 50)));
}

export function getOcrHistory(): OcrCache[] {
  const raw = ocrStorage.getString("history");
  return raw ? JSON.parse(raw) : [];
}

export function clearOcrHistory() {
  ocrStorage.set("history", JSON.stringify([]));
}

export function parseScheduleText(text: string): Partial<CalendarEvent>[] {
  const events: Partial<CalendarEvent>[] = [];

  const patterns = [
    /(.+?)\s+(?:at|@|–|-)\s+(\d{1,2}:\d{2})\s*(?:am|pm)?/gi,
    /(\d{1,2}:\d{2})\s*(?:am|pm)?\s*(?:-|–|to)\s*(\d{1,2}:\d{2})\s*(?:am|pm)?\s*(.+)/gi,
    /(.+?)\s+(?:on\s+)?(\w+\s+\d{1,2}(?:st|nd|rd|th)?)/gi,
  ];

  const today = new Date();
  const lines = text.split("\n").filter(Boolean);

  for (const line of lines) {
    for (const pattern of patterns) {
      const match = pattern.exec(line);
      if (match) {
        const groups = match.filter((_, i) => i > 0);
        const title = groups[groups.length - 1]?.trim() || "Untitled";
        events.push({
          title,
          startDate: today.toISOString(),
          endDate: today.toISOString(),
          source: "ocr",
        });
        break;
      }
    }
  }

  return events;
}
