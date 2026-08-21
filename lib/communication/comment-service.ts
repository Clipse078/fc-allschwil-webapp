/**
 * lib/communication/comment-service.ts
 *
 * COMM-01A/01B: Tenant-scoped internal comments and @mentions.
 */

import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenants/require-tenant";
import { CommunicationServiceError, assertTenantId } from "@/lib/communication/errors";
import {
  getCommunicationThreadForTarget,
  requireCommunicationThreadForTenant,
} from "@/lib/communication/thread-service";
import { recordCommunicationAuditEvent } from "@/lib/communication/audit-integration";
import { notifyCommentMentions } from "@/lib/communication/mention-notifications";
import { MAX_INTERNAL_COMMENT_BODY_LENGTH } from "@/lib/communication/constants";
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

function normalizeBody(body: string): string {
  const normalized = body.trim();
  if (!normalized) {
    throw new CommunicationServiceError("INVALID_INPUT", "Kommentartext ist erforderlich.");
  }
  if (normalized.length > MAX_INTERNAL_COMMENT_BODY_LENGTH) {
    throw new CommunicationServiceError(
      "INVALID_INPUT",
      `Kommentartext darf maximal ${MAX_INTERNAL_COMMENT_BODY_LENGTH} Zeichen enthalten.`,
    );
  }
  return normalized;
}

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
      user: { isActive: true },
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

async function requireActiveCommentForTenant(
  tenantId: string,
  commentId: string,
): Promise<InternalCommentRecord> {
  const comment = await prisma.internalComment.findFirst({
    where: { id: commentId, tenantId },
    select: commentSelect,
  });

  if (!comment || comment.deletedAt) {
    throw new CommunicationServiceError(
      "COMMENT_NOT_FOUND",
      "Kommentar nicht gefunden oder gehört zu einem anderen Mandanten.",
    );
  }

  return comment;
}

async function recordCommentAudit(
  kind: "INTERNAL_COMMENT_CREATED" | "INTERNAL_COMMENT_UPDATED" | "INTERNAL_COMMENT_DELETED",
  tenantId: string,
  thread: { id: string; targetType: CommunicationTargetType; targetId: string },
  commentId: string,
  actorUserId: string,
): Promise<void> {
  const summaries: Record<typeof kind, string> = {
    INTERNAL_COMMENT_CREATED: "Interner Kommentar erstellt",
    INTERNAL_COMMENT_UPDATED: "Interner Kommentar bearbeitet",
    INTERNAL_COMMENT_DELETED: "Interner Kommentar gelöscht",
  };

  await recordCommunicationAuditEvent({
    tenantId,
    actorUserId,
    kind,
    threadId: thread.id,
    targetType: thread.targetType,
    targetId: thread.targetId,
    entityId: commentId,
    summary: summaries[kind],
  });
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
    },
    select: commentSelect,
    orderBy: { createdAt: "asc" },
  });
}

export async function getInternalCommentByIdForTenant(
  tenantId: string,
  commentId: string,
  options: { includeDeleted?: boolean } = {},
): Promise<InternalCommentRecord | null> {
  assertTenantId(tenantId);
  return prisma.internalComment.findFirst({
    where: {
      id: commentId,
      tenantId,
      ...(options.includeDeleted ? {} : { deletedAt: null }),
    },
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
  const normalizedBody = normalizeBody(body);
  const normalizedAuthorUserId = authorUserId.trim();

  if (!normalizedAuthorUserId) {
    throw new CommunicationServiceError("INVALID_INPUT", "authorUserId ist erforderlich.");
  }

  const thread = await requireCommunicationThreadForTenant(tenantId, threadId);

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

  const comment = await prisma.internalComment.create({
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

  await recordCommentAudit(
    "INTERNAL_COMMENT_CREATED",
    tenantId,
    thread,
    comment.id,
    normalizedAuthorUserId,
  );

  if (validatedMentionIds.length > 0) {
    await notifyCommentMentions(
      validatedMentionIds.map((mentionedUserId) => ({
        tenantId,
        threadId,
        commentId: comment.id,
        mentionedUserId,
        authorUserId: normalizedAuthorUserId,
      })),
    );
  }

  return comment;
}

export async function updateInternalComment(
  tenantId: string,
  threadId: string,
  commentId: string,
  actorUserId: string,
  body: string,
  mentionedUserIds: string[] = [],
): Promise<InternalCommentRecord> {
  assertTenantId(tenantId);
  const normalizedBody = normalizeBody(body);
  const normalizedActorUserId = actorUserId.trim();

  const thread = await requireCommunicationThreadForTenant(tenantId, threadId);
  const existing = await requireActiveCommentForTenant(tenantId, commentId);

  if (existing.threadId !== threadId) {
    throw new CommunicationServiceError(
      "COMMENT_NOT_FOUND",
      "Kommentar nicht gefunden oder gehört zu einem anderen Mandanten.",
    );
  }

  if (existing.authorUserId !== normalizedActorUserId) {
    throw new CommunicationServiceError(
      "COMMENT_FORBIDDEN",
      "Nur der Autor kann diesen Kommentar bearbeiten.",
    );
  }

  const validatedMentionIds = await validateMentionedUsersForTenant(tenantId, mentionedUserIds);

  const comment = await prisma.$transaction(async (tx) => {
    await tx.commentMention.deleteMany({
      where: { tenantId, commentId },
    });

    if (validatedMentionIds.length > 0) {
      await tx.commentMention.createMany({
        data: validatedMentionIds.map((mentionedUserId) => ({
          tenantId,
          commentId,
          mentionedUserId,
        })),
      });
    }

    return tx.internalComment.update({
      where: { id: commentId },
      data: { body: normalizedBody },
      select: commentSelect,
    });
  });

  await recordCommentAudit(
    "INTERNAL_COMMENT_UPDATED",
    tenantId,
    thread,
    comment.id,
    normalizedActorUserId,
  );

  if (validatedMentionIds.length > 0) {
    await notifyCommentMentions(
      validatedMentionIds.map((mentionedUserId) => ({
        tenantId,
        threadId,
        commentId: comment.id,
        mentionedUserId,
        authorUserId: normalizedActorUserId,
      })),
    );
  }

  return comment;
}

export async function softDeleteInternalComment(
  tenantId: string,
  threadId: string,
  commentId: string,
  actorUserId: string,
): Promise<InternalCommentRecord> {
  assertTenantId(tenantId);
  const normalizedActorUserId = actorUserId.trim();

  const thread = await requireCommunicationThreadForTenant(tenantId, threadId);
  const existing = await requireActiveCommentForTenant(tenantId, commentId);

  if (existing.threadId !== threadId) {
    throw new CommunicationServiceError(
      "COMMENT_NOT_FOUND",
      "Kommentar nicht gefunden oder gehört zu einem anderen Mandanten.",
    );
  }

  if (existing.authorUserId !== normalizedActorUserId) {
    throw new CommunicationServiceError(
      "COMMENT_FORBIDDEN",
      "Nur der Autor kann diesen Kommentar löschen.",
    );
  }

  const comment = await prisma.$transaction(async (tx) => {
    await tx.commentMention.deleteMany({
      where: { tenantId, commentId },
    });

    return tx.internalComment.update({
      where: { id: commentId },
      data: { deletedAt: new Date() },
      select: commentSelect,
    });
  });

  await recordCommentAudit(
    "INTERNAL_COMMENT_DELETED",
    tenantId,
    thread,
    comment.id,
    normalizedActorUserId,
  );

  return comment;
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
