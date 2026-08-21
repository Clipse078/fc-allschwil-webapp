/**
 * lib/communication/comment-enrichment.ts
 *
 * COMM-01B: Resolve human-facing author and mention identities for API/UI.
 */

import { prisma } from "@/lib/db/prisma";
import { resolveAuditActorDisplayName } from "@/lib/registrations/actor-display";
import type { InternalCommentRecord } from "@/lib/communication/comment-service";

export type EnrichedMention = {
  id: string;
  mentionedUserId: string;
  displayName: string;
};

export type EnrichedInternalComment = {
  id: string;
  threadId: string;
  authorUserId: string;
  authorDisplayName: string;
  body: string | null;
  isDeleted: boolean;
  isEdited: boolean;
  createdAt: string;
  updatedAt: string;
  mentions: EnrichedMention[];
};

function auditActorSelect(tenantId: string) {
  return {
    firstName: true,
    lastName: true,
    email: true,
    person: {
      where: { tenantId },
      select: {
        firstName: true,
        lastName: true,
        displayName: true,
      },
    },
  } as const;
}

export async function enrichInternalComments(
  tenantId: string,
  comments: InternalCommentRecord[],
): Promise<EnrichedInternalComment[]> {
  if (comments.length === 0) return [];

  const userIds = new Set<string>();
  for (const comment of comments) {
    userIds.add(comment.authorUserId);
    for (const mention of comment.mentions) {
      userIds.add(mention.mentionedUserId);
    }
  }

  const users = await prisma.user.findMany({
    where: { id: { in: [...userIds] } },
    select: {
      id: true,
      ...auditActorSelect(tenantId),
    },
  });

  const displayByUserId = new Map<string, string>();
  for (const user of users) {
    displayByUserId.set(
      user.id,
      resolveAuditActorDisplayName(user) ?? user.email ?? "Unbekannt",
    );
  }

  return comments.map((comment) => {
    const isDeleted = comment.deletedAt !== null;
    const isEdited = !isDeleted && comment.updatedAt.getTime() > comment.createdAt.getTime() + 1000;

    return {
      id: comment.id,
      threadId: comment.threadId,
      authorUserId: comment.authorUserId,
      authorDisplayName: displayByUserId.get(comment.authorUserId) ?? "Unbekannt",
      body: isDeleted ? null : comment.body,
      isDeleted,
      isEdited,
      createdAt: comment.createdAt.toISOString(),
      updatedAt: comment.updatedAt.toISOString(),
      mentions: isDeleted
        ? []
        : comment.mentions.map((mention) => ({
            id: mention.id,
            mentionedUserId: mention.mentionedUserId,
            displayName: displayByUserId.get(mention.mentionedUserId) ?? "Unbekannt",
          })),
    };
  });
}
