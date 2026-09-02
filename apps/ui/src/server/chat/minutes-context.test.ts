import { describe, expect, it } from "vitest";
import {
  buildKnowledgeContext,
  buildRetrievedContext,
} from "@/server/chat/minutes-context";
import type { KnowledgeDoc } from "@/server/chat/knowledge-types";
import type { RetrievedChunk } from "@/server/chat/vector-index";

function knowledge(
  overrides: Partial<KnowledgeDoc> & Pick<KnowledgeDoc, "sourceKey">,
): KnowledgeDoc {
  return {
    sourceType: "minutes",
    title: `エピソード ${overrides.sourceKey}`,
    url: "/episodes/1",
    content: "本文",
    ...overrides,
  };
}

function chunk(overrides: Partial<RetrievedChunk>): RetrievedChunk {
  return {
    sourceType: "minutes",
    sourceKey: "minutes:1",
    title: "タイトル",
    url: "/episodes/1",
    text: "本文",
    ...overrides,
  };
}

describe("buildKnowledgeContext", () => {
  it("formats sources with type label, title, and url header", () => {
    const context = buildKnowledgeContext([
      knowledge({
        sourceKey: "minutes:3",
        title: "DB選定",
        url: "/episodes/3",
        content: "Cloud SQLの話",
      }),
    ]);
    expect(context).toContain("## 【議事録】DB選定");
    expect(context).toContain("URL: /episodes/3");
    expect(context).toContain("Cloud SQLの話");
  });

  it("labels agenda and sns sources", () => {
    const context = buildKnowledgeContext([
      knowledge({
        sourceKey: "agenda:a1",
        sourceType: "agenda",
        title: "次回議題（2026-07 前半）",
        url: "/agenda?proposal=a1",
      }),
      knowledge({
        sourceKey: "sns:1:p1",
        sourceType: "sns",
        title: "SNS投稿（DB選定）",
        url: "/sns?episode=1&post=p1",
      }),
    ]);
    expect(context).toContain("## 【次回議題】次回議題（2026-07 前半）");
    expect(context).toContain("URL: /agenda?proposal=a1");
    expect(context).toContain("## 【SNS投稿】SNS投稿（DB選定）");
    expect(context).toContain("URL: /sns?episode=1&post=p1");
  });

  it("returns an empty string when there are no sources", () => {
    expect(buildKnowledgeContext([])).toBe("");
  });

  it("truncates per-source content beyond the limit", () => {
    const context = buildKnowledgeContext(
      [knowledge({ sourceKey: "minutes:1", content: "あ".repeat(100) })],
      { maxPerSourceChars: 10 },
    );
    expect(context).toContain("…（以下省略）");
    expect(context).not.toContain("あ".repeat(11));
  });

  it("stops adding sources once the total budget is exceeded", () => {
    const context = buildKnowledgeContext(
      [
        knowledge({ sourceKey: "minutes:1", title: "第1回", content: "x".repeat(50) }),
        knowledge({ sourceKey: "minutes:2", title: "第2回", content: "y".repeat(50) }),
      ],
      { maxTotalChars: 120 },
    );
    expect(context).toContain("## 【議事録】第1回");
    expect(context).not.toContain("## 【議事録】第2回");
  });
});

describe("buildRetrievedContext", () => {
  it("groups chunks from the same source under one header", () => {
    const context = buildRetrievedContext([
      chunk({ sourceKey: "minutes:5", title: "DB選定", url: "/episodes/5", text: "前半の話" }),
      chunk({ sourceKey: "minutes:5", title: "DB選定", url: "/episodes/5", text: "後半の話" }),
    ]);
    expect(context.match(/## 【議事録】DB選定/g)).toHaveLength(1);
    expect(context).toContain("URL: /episodes/5");
    expect(context).toContain("前半の話");
    expect(context).toContain("後半の話");
  });

  it("keeps separate headers for different sources", () => {
    const context = buildRetrievedContext([
      chunk({ sourceKey: "minutes:5", title: "DB選定", url: "/episodes/5" }),
      chunk({
        sourceKey: "agenda:a1",
        sourceType: "agenda",
        title: "次回議題（2026-07）",
        url: "/agenda?proposal=a1",
      }),
    ]);
    expect(context).toContain("## 【議事録】DB選定");
    expect(context).toContain("## 【次回議題】次回議題（2026-07）");
  });

  it("skips empty chunks and returns empty string when nothing remains", () => {
    expect(buildRetrievedContext([])).toBe("");
    expect(buildRetrievedContext([chunk({ text: "  " })])).toBe("");
  });
});
