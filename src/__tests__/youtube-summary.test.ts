jest.mock("expo-file-system", () => ({
  cacheDirectory: "/mock-cache/",
  documentDirectory: "/mock-documents/",
  getInfoAsync: jest.fn(),
  downloadAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
}));

jest.mock("expo-file-system/legacy", () => ({
  __esModule: true,
  default: {
    cacheDirectory: "/mock-cache/",
    documentDirectory: "/mock-documents/",
    getInfoAsync: jest.fn(),
    downloadAsync: jest.fn(),
    readAsStringAsync: jest.fn(),
  },
  cacheDirectory: "/mock-cache/",
  documentDirectory: "/mock-documents/",
  getInfoAsync: jest.fn(),
  downloadAsync: jest.fn(),
  readAsStringAsync: jest.fn(),
}));

jest.mock("openai", () => {
  return {
    __esModule: true,
    default: jest.fn(() => ({
      chat: {
        completions: {
          create: jest.fn(),
        },
      },
    })),
  };
});

jest.mock("expo-document-picker", () => ({
  getDocumentAsync: jest.fn(),
}));

jest.mock("@/stores/settings-store", () => ({
  useSettingsStore: {
    getState: () => ({
      apiKeys: { nim: "" },
      nimEndpoint: "",
      nimModel: "",
    }),
  },
}));

jest.mock("@/services/local-llama", () => ({
  isModelLoaded: jest.fn(() => false),
  generateResponse: jest.fn(),
}));

jest.mock("expo-file-system/expo-file-system", () => ({}), { virtual: true });

import {
  extractVideoId,
  formatTimestamp,
  parseXmlTranscript,
  buildSummaryText,
} from "../services/youtube-summary";

describe("extractVideoId", () => {
  it("extracts from youtube.com/watch?v=", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts from youtu.be/", () => {
    expect(extractVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts from youtube.com/embed/", () => {
    expect(extractVideoId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts bare 11-char ID", () => {
    expect(extractVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("extracts with extra params", () => {
    expect(extractVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30s")).toBe("dQw4w9WgXcQ");
  });
  it("returns null for non-matching URL", () => {
    expect(extractVideoId("https://example.com")).toBeNull();
  });
  it("returns null for empty string", () => {
    expect(extractVideoId("")).toBeNull();
  });
  it("returns null for wrong-length bare ID", () => {
    expect(extractVideoId("abc")).toBeNull();
  });
});

describe("formatTimestamp", () => {
  it("formats seconds only", () => {
    expect(formatTimestamp(0)).toBe("0:00");
    expect(formatTimestamp(5)).toBe("0:05");
    expect(formatTimestamp(59)).toBe("0:59");
  });
  it("formats minutes", () => {
    expect(formatTimestamp(60)).toBe("1:00");
    expect(formatTimestamp(90)).toBe("1:30");
    expect(formatTimestamp(3599)).toBe("59:59");
  });
  it("formats hours", () => {
    expect(formatTimestamp(3600)).toBe("1:00:00");
    expect(formatTimestamp(3661)).toBe("1:01:01");
    expect(formatTimestamp(7384)).toBe("2:03:04");
  });
  it("handles float seconds", () => {
    expect(formatTimestamp(1.5)).toBe("0:01");
  });
});

describe("parseXmlTranscript", () => {
  it("parses a simple xml transcript", () => {
    const xml = `<transcript>
<text start="0" dur="2.5">Hello world</text>
<text start="2.5" dur="3.1">This is a test</text>
</transcript>`;
    const segments = parseXmlTranscript(xml);
    expect(segments).toHaveLength(2);
    expect(segments[0]).toEqual({ start: 0, duration: 2.5, text: "Hello world" });
    expect(segments[1]).toEqual({ start: 2.5, duration: 3.1, text: "This is a test" });
  });
  it("handles html entities", () => {
    const xml = `<text start="0" dur="1">&amp;#39;tis &amp; &lt; &gt; &quot;test&quot;</text>`;
    const segments = parseXmlTranscript(xml);
    expect(segments[0].text).toBe("'tis & < > \"test\"");
  });
  it("removes bracketed annotations like [Music]", () => {
    const xml = `<text start="0" dur="1">Hello [Music] world [Applause]</text>`;
    const segments = parseXmlTranscript(xml);
    // NOTE: the regex replaces [...] with empty string so double spaces can occur
    expect(segments[0].text).toBe("Hello  world");
  });
  it("returns empty array for empty input", () => {
    expect(parseXmlTranscript("")).toEqual([]);
  });
  it("returns empty array when no text elements", () => {
    expect(parseXmlTranscript("<xml></xml>")).toEqual([]);
  });
});

describe("buildSummaryText", () => {
  const videoInfo = {
    videoId: "dQw4w9WgXcQ",
    title: "Never Gonna Give You Up",
    author: "Rick Astley",
    channelUrl: "https://youtube.com/@RickAstley",
    duration: 212,
    thumbnailUrl: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
  };
  const segments = [
    { start: 0, duration: 2.5, text: "We're no strangers to love" },
    { start: 2.5, duration: 3.0, text: "You know the rules and so do I" },
  ];
  it("includes video title, author, and duration", () => {
    const text = buildSummaryText(videoInfo, segments);
    expect(text).toContain("Never Gonna Give You Up");
    expect(text).toContain("Rick Astley");
    expect(text).toContain("https://youtube.com/watch?v=dQw4w9WgXcQ");
    expect(text).toContain("3:32");
  });
  it("includes each segment with timestamp", () => {
    const text = buildSummaryText(videoInfo, segments);
    expect(text).toContain("0:00 - 0:02 We're no strangers to love");
    expect(text).toContain("0:02 - 0:05 You know the rules and so do I");
  });
  it("skips empty segments", () => {
    const segs = [
      { start: 0, duration: 1, text: "Hello" },
      { start: 1, duration: 1, text: "" },
      { start: 2, duration: 1, text: "World" },
    ];
    const text = buildSummaryText(videoInfo, segs);
    expect(text).toContain("Hello");
    expect(text).toContain("World");
    expect(text).not.toContain(" -  ");
  });
  it("includes short description when present", () => {
    const info = { ...videoInfo, shortDescription: "Official music video" };
    const text = buildSummaryText(info, segments);
    expect(text).toContain("Official music video");
  });
  it("works with empty segments", () => {
    const text = buildSummaryText(videoInfo, []);
    expect(text).toContain("Never Gonna Give You Up");
    // "Chapter Summary" header is always added, only segment lines are skipped
    expect(text).toContain("Chapter Summary");
  });
});
