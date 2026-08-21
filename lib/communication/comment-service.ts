/**
 * lib/communication/comment-service.ts
 *
 * COMM-01A: Tenant-scoped internal comments and @mentions foundation.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenants/require-tenant";
import { CommunicationServiceError, assertTenantId } from "@/lib/communication/errors";
import {
  getCommunicationThreadForTarget,
  requireCommunicationThreadForTenant,
} from "@/lib/communication/thread-service";
import type { CommunicationTargetType } from "@prisma/client";

const commentSelect = {
  id: true,
  tenantId: true,
  threadId: true,
  authorUserId: true,
  body: true,
  deletedAt: true,
  createdAt: true,
  updatedAt: true,
  mentions: {
    select: {
      id: true,
      tenantId: true,
      commentId: true,
      mentionedUserId: true,
      createdAt: true,
    },
  },
} as const;

export type InternalCommentRecord = Prisma.InternalCommentGetPayload<{
  select: typeof commentSelect;
}>;

async function validateMentionedUsersForTenant(
  tenantId: string,
  mentionedUserIds: string[],
): Promise<string[]> {
  const uniqueIds = [...new Set(mentionedUserIds.map((id) => id.trim()).filter(Boolean))];
  if (uniqueIds.length === 0) {
    return [];
  }

  const memberships = await prisma.tenantMembership.findMany({
    where: {
      tenantId,
      isActive: true,
      userId: { in: uniqueIds },
      tenant: { status: "ACTIVE" },
    },
    select: { userId: true },
  });

  const allowed = new Set(memberships.map((m) => m.userId));
  const rejected = uniqueIds.filter((id) => !allowed.has(id));

  if (rejected.length > 0) {
    throw new CommunicationServiceError(
      "MENTION_FORBIDDEN",
      "Erwähnte Benutzer sind in diesem Mandanten nicht berechtigt.",
    );
  }

  return uniqueIds;
}

export async function listInternalComments(
  tenantId: string,
  threadId: string,
): Promise<InternalCommentRecord[]> {
  assertTenantId(tenantId);
  await requireCommunicationThreadForTenant(tenantId, threadId);

  return prisma.internalComment.findMany({
    where: {
      tenantId,
      threadId,
      deletedAt: null,
    },
    select: commentSelect,
    orderBy: { createdAt: "asc" },
  });
}

export async function getInternalCommentByIdForTenant(
  tenantId: string,
  commentId: string,
): Promise<InternalCommentRecord | null> {
  assertTenantId(tenantId);
  return prisma.internalComment.findFirst({
    where: { id: commentId, tenantId, deletedAt: null },
    select: commentSelect,
  });
}

export async function createInternalComment(
  tenantId: string,
  threadId: string,
  authorUserId: string,
  body: string,
  mentionedUserIds: string[] = [],
): Promise<InternalCommentRecord> {
  assertTenantId(tenantId);
  const normalizedBody = body.trim();
  const normalizedAuthorUserId = authorUserId.trim();

  if (!normalizedBody) {
    throw new CommunicationServiceError("INVALID_INPUT", "Kommentartext ist erforderlich.");
  }
  if (!normalizedAuthorUserId) {
    throw new CommunicationServiceError("INVALID_INPUT", "authorUserId ist erforderlich.");
  }

  await requireCommunicationThreadForTenant(tenantId, threadId);

  const authorMembership = await prisma.tenantMembership.findFirst({
    where: {
      tenantId,
      userId: normalizedAuthorUserId,
      isActive: true,
      tenant: { status: "ACTIVE" },
    },
    select: { id: true },
  });

  if (!authorMembership) {
    throw new CommunicationServiceError(
      "TENANT_FORBIDDEN",
      "Autor ist in diesem Mandanten nicht berechtigt.",
    );
  }

  const validatedMentionIds = await validateMentionedUsersForTenant(tenantId, mentionedUserIds);

  return prisma.internalComment.create({
    data: {
      tenantId,
      threadId,
      authorUserId: normalizedAuthorUserId,
      body: normalizedBody,
      mentions: validatedMentionIds.length
        ? {
            create: validatedMentionIds.map((mentionedUserId) => ({
              tenantId,
              mentionedUserId,
            })),
          }
        : undefined,
    },
    select: commentSelect,
  });
}

export async function createCommentMentions(
  tenantId: string,
  commentId: string,
  mentionedUserIds: string[],
): Promise<InternalCommentRecord> {
  assertTenantId(tenantId);

  const comment = await prisma.internalComment.findFirst({
    where: { id: commentId, tenantId, deletedAt: null },
    select: { id: true, threadId: true },
  });

  if (!comment) {
    throw new CommunicationServiceError(
      "COMMENT_NOT_FOUND",
      "Kommentar nicht gefunden oder gehört zu einem anderen Mandanten.",
    );
  }

  const validatedMentionIds = await validateMentionedUsersForTenant(tenantId, mentionedUserIds);

  if (validatedMentionIds.length > 0) {
    await prisma.commentMention.createMany({
      data: validatedMentionIds.map((mentionedUserId) => ({
        tenantId,
        commentId,
        mentionedUserId,
      })),
      skipDuplicates: true,
    });
  }

  const updated = await getInternalCommentByIdForTenant(tenantId, commentId);
  if (!updated) {
    throw new CommunicationServiceError("COMMENT_NOT_FOUND", "Kommentar nicht gefunden.");
  }
  return updated;
}

export async function listInternalCommentsForTarget(
  tenantSlug: string,
  targetType: CommunicationTargetType,
  targetId: string,
): Promise<InternalCommentRecord[]> {
  const tenant = await requireTenant(tenantSlug);
  const thread = await getCommunicationThreadForTarget(tenantSlug, targetType, targetId);

  if (!thread) {
    return [];
  }

  return listInternalComments(tenant.id, thread.id);
}
