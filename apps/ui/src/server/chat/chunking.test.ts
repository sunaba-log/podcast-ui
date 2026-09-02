import { describe, expect, it } from "vitest";
import { chunkText } from "@/server/chat/chunking";

describe("chunkText", () => {
  it("returns no chunks for empty text", () => {
    expect(chunkText("   \n\n  ")).toEqual([]);
  });

  it("returns a single chunk when text fits", () => {
    const chunks = chunkText("短い議事録", { maxChars: 100 });
    expect(chunks).toEqual([{ index: 0, text: "短い議事録" }]);
  });

  it("splits long text into sequential overlapping chunks", () => {
    const text = "あ".repeat(250);
    const chunks = chunkText(text, { maxChars: 100, overlap: 20 });
    expect(chunks.length).toBeGreaterThan(1);
    expect(chunks.map((c) => c.index)).toEqual(
      chunks.map((_, i) => i),
    );
    // step = 80。各チャンクは最大 100 文字。
    expect(chunks[0].text.length).toBe(100);
    expect(chunks[chunks.length - 1].text.length).toBeLessThanOrEqual(100);
  });

  it("covers the entire input across chunks", () => {
    const text = "x".repeat(500);
    const chunks = chunkText(text, { maxChars: 120, overlap: 30 });
    const reconstructedLength = chunks.reduce(
      (max, chunk, i) => Math.max(max, i * (120 - 30) + chunk.text.length),
      0,
    );
    expect(reconstructedLength).toBe(500);
  });
});
