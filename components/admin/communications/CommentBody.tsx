"use client";

/**
 * COMM-01B — Safe plain-text comment body with @mention highlighting.
 */

import { useMemo, type ReactNode } from "react";
import type { EnrichedMention } from "@/lib/communication/comment-enrichment";

type Segment = { type: "text" | "mention"; value: string };

function buildSegments(body: string, mentions: EnrichedMention[]): Segment[] {
  if (!body) return [];
  if (mentions.length === 0) return [{ type: "text", value: body }];

  const tokens = mentions
    .map((mention) => ({
      mention,
      token: `@${mention.displayName}`,
      index: body.indexOf(`@${mention.displayName}`),
    }))
    .filter((item) => item.index >= 0)
    .sort((a, b) => a.index - b.index);

  const segments: Segment[] = [];
  let cursor = 0;

  for (const item of tokens) {
    if (item.index < cursor) continue;
    if (item.index > cursor) {
      segments.push({ type: "text", value: body.slice(cursor, item.index) });
    }
    segments.push({ type: "mention", value: item.mention.displayName });
    cursor = item.index + item.token.length;
  }

  if (cursor < body.length) {
    segments.push({ type: "text", value: body.slice(cursor) });
  }

  return segments.length > 0 ? segments : [{ type: "text", value: body }];
}

export function CommentBody({
  body,
  mentions,
}: {
  body: string;
  mentions: EnrichedMention[];
}) {
  const segments = useMemo(() => buildSegments(body, mentions), [body, mentions]);

  const nodes: ReactNode[] = segments.map((segment, index) => {
    if (segment.type === "mention") {
      return (
        <span key={`m-${index}`} className="font-semibold text-[var(--blue)]">
          @{segment.value}
        </span>
      );
    }
    return <span key={`t-${index}`}>{segment.value}</span>;
  });

  return <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-[var(--foreground)]">{nodes}</p>;
}
