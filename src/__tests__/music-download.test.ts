import { extractArtist, extractThumbnail } from "../services/music-download";


// -----------------------------------------------------------------------
// extractArtist
// -----------------------------------------------------------------------
describe("extractArtist", () => {
  it("extracts from artists array", () => {
    const item = { artists: [{ name: "Rick Astley" }] };
    expect(extractArtist(item)).toBe("Rick Astley");
  });

  it("extracts from author", () => {
    const item = { author: { name: "Rick Astley" } };
    expect(extractArtist(item)).toBe("Rick Astley");
  });

  it("prefers artists over author", () => {
    const item = { artists: [{ name: "Official Artist" }], author: { name: "Channel Name" } };
    expect(extractArtist(item)).toBe("Official Artist");
  });

  it("returns empty string when neither exists", () => {
    expect(extractArtist({})).toBe("");
  });
});

// -----------------------------------------------------------------------
// extractThumbnail
// -----------------------------------------------------------------------
describe("extractThumbnail", () => {
  it("extracts from thumbnails array (last = highest res)", () => {
    const item = {
      thumbnails: [
        { url: "https://example.com/small.jpg", width: 120 },
        { url: "https://example.com/large.jpg", width: 480 },
      ],
    };
    expect(extractThumbnail(item)).toBe("https://example.com/large.jpg");
  });

  it("extracts from thumbnail array", () => {
    const item = {
      thumbnail: [
        { url: "https://example.com/thumb.jpg", width: 120 },
      ],
    };
    expect(extractThumbnail(item)).toBe("https://example.com/thumb.jpg");
  });

  it("returns empty string when no thumbs", () => {
    expect(extractThumbnail({})).toBe("");
  });

  it("returns empty string for empty array", () => {
    const item = { thumbnails: [] };
    expect(extractThumbnail(item)).toBe("");
  });
});
