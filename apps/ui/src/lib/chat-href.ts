/**
 * チャット回答内のリンク href を正規化する。
 *
 * LLM はプロンプトで「URL をそのまま使う」と指示しても、先頭スラッシュの欠落
 * （`sns?episode=4`）、余計な `?` の付加（`?agenda?proposal=...`）、自ドメインの
 * 付加（`https://dev.sparkcast.sunabalog.com/...`）などの揺れを完全には防げない。
 * 表示側で決定的に補正し、アプリ内リンクとして解決できたものだけ内部遷移させる。
 */

const APP_HOST_PATTERN = /(^|\.)sunabalog\.com$|\.run\.app$|^localhost(:\d+)?$/;
const INTERNAL_PATH_PREFIX = /^(agenda|sns|episodes)([/?#]|$)/;

export type NormalizedHref = {
  href: string;
  isInternal: boolean;
};

export function normalizeChatHref(raw: string | undefined | null): NormalizedHref {
  const original = (raw ?? "").trim();
  if (!original) return { href: "", isInternal: false };
  let candidate = original;

  // 絶対 URL: 自アプリのホストなら相対化、他ドメインは外部リンクのまま
  const absolute = candidate.match(/^https?:\/\/([^/?#]+)([/?#].*)?$/i);
  if (absolute) {
    if (!APP_HOST_PATTERN.test(absolute[1].toLowerCase())) {
      return { href: original, isInternal: false };
    }
    candidate = absolute[2] ?? "/";
    if (!candidate.startsWith("/")) candidate = `/${candidate}`;
  }

  // 先頭の余計な "?"（例: "?agenda?proposal=..."）を除去
  candidate = candidate.replace(/^\?+(?=(agenda|sns|episodes)\b)/, "");

  // 先頭スラッシュの欠落（例: "sns?episode=4&post=..."）を補完
  if (INTERNAL_PATH_PREFIX.test(candidate)) candidate = `/${candidate}`;

  // "episode=2" / "?episode=2" はトップの閲覧ディープリンク（/?episode=2）へ
  if (/^\/?\??episode=/.test(candidate)) {
    candidate = `/?${candidate.replace(/^\/?\??/, "")}`;
  }

  if (!candidate.startsWith("/")) return { href: original, isInternal: false };

  // 2 個目以降の "?" を "&" に補正（例: "/agenda?proposal=x?topic=1"）
  const queryIndex = candidate.indexOf("?");
  if (queryIndex >= 0) {
    candidate =
      candidate.slice(0, queryIndex + 1) +
      candidate.slice(queryIndex + 1).replace(/\?/g, "&");
  }

  return { href: candidate, isInternal: true };
}
