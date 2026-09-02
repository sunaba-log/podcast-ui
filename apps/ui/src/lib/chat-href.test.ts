import { describe, expect, it } from "vitest";
import { normalizeChatHref } from "@/lib/chat-href";

describe("normalizeChatHref", () => {
  it("keeps well-formed internal links as-is", () => {
    expect(normalizeChatHref("/?episode=2")).toEqual({
      href: "/?episode=2",
      isInternal: true,
    });
    expect(normalizeChatHref("/agenda?proposal=a1&topic=1")).toEqual({
      href: "/agenda?proposal=a1&topic=1",
      isInternal: true,
    });
    expect(normalizeChatHref("/sns?episode=2&post=p1")).toEqual({
      href: "/sns?episode=2&post=p1",
      isInternal: true,
    });
  });

  it("adds the missing leading slash (reported: sns?episode=4&post=...)", () => {
    expect(
      normalizeChatHref("sns?episode=4&post=9ef45171bb454a1c9bb3be51d9987dc5"),
    ).toEqual({
      href: "/sns?episode=4&post=9ef45171bb454a1c9bb3be51d9987dc5",
      isInternal: true,
    });
    expect(normalizeChatHref("agenda?proposal=x")).toEqual({
      href: "/agenda?proposal=x",
      isInternal: true,
    });
  });

  it("strips the stray leading '?' (reported: ?agenda?proposal=...&topic=1)", () => {
    expect(
      normalizeChatHref("?agenda?proposal=2a7eab9ed0a0460782fa75a98bb35836&topic=1"),
    ).toEqual({
      href: "/agenda?proposal=2a7eab9ed0a0460782fa75a98bb35836&topic=1",
      isInternal: true,
    });
  });

  it("normalizes bare episode=N into the top-page deep link", () => {
    expect(normalizeChatHref("episode=1")).toEqual({
      href: "/?episode=1",
      isInternal: true,
    });
    expect(normalizeChatHref("?episode=1")).toEqual({
      href: "/?episode=1",
      isInternal: true,
    });
    expect(normalizeChatHref("/episode=1")).toEqual({
      href: "/?episode=1",
      isInternal: true,
    });
  });

  it("relativizes app-domain absolute urls", () => {
    expect(
      normalizeChatHref("https://dev.sparkcast.sunabalog.com/agenda?proposal=a1"),
    ).toEqual({ href: "/agenda?proposal=a1", isInternal: true });
    expect(
      normalizeChatHref("https://sparkcast.sunabalog.com/?episode=3"),
    ).toEqual({ href: "/?episode=3", isInternal: true });
    expect(
      normalizeChatHref(
        "https://pr-76---podcast-ui-dev-jztgcd4mia-an.a.run.app/sns?episode=1&post=p",
      ),
    ).toEqual({ href: "/sns?episode=1&post=p", isInternal: true });
  });

  it("fixes a second '?' in the query into '&'", () => {
    expect(normalizeChatHref("/agenda?proposal=x?topic=1")).toEqual({
      href: "/agenda?proposal=x&topic=1",
      isInternal: true,
    });
  });

  it("keeps external links external", () => {
    expect(normalizeChatHref("https://example.com/news")).toEqual({
      href: "https://example.com/news",
      isInternal: false,
    });
    expect(
      normalizeChatHref("https://vertexaisearch.cloud.google.com/redirect/abc"),
    ).toEqual({
      href: "https://vertexaisearch.cloud.google.com/redirect/abc",
      isInternal: false,
    });
  });

  it("returns empty href for empty input", () => {
    expect(normalizeChatHref(undefined)).toEqual({ href: "", isInternal: false });
    expect(normalizeChatHref("  ")).toEqual({ href: "", isInternal: false });
  });
});
