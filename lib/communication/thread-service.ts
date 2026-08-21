/**
 * lib/communication/thread-service.ts
 *
 * COMM-01A: Tenant-scoped communication thread lifecycle.
 */

import type { CommunicationTargetType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenants/require-tenant";
import { CommunicationServiceError, assertTenantId } from "@/lib/communication/errors";
import { generateInboundReplyToken } from "@/lib/communication/inbound-token";
import { resolveCommunicationTargetForTenant } from "@/lib/communication/target-resolver";

function isStableInboundReplyToken(token: string): boolean {
  // Lower-case hex survives common email address normalization.
  return /^[a-f0-9]{64}$/.test(token);
}

const threadSelect = {
  id: true,
  tenantId: true,
  targetType: true,
  targetId: true,
  inboundReplyToken: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type CommunicationThreadRecord = {
  id: string;
  tenantId: string;
  targetType: CommunicationTargetType;
  targetId: string;
  inboundReplyToken: string;
  createdByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

async function getThreadForTenantOrNull(
  tenantId: string,
  threadId: string,
): Promise<CommunicationThreadRecord | null> {
  return prisma.communicationThread.findFirst({
    where: { id: threadId, tenantId },
    select: threadSelect,
  });
}

export async function getCommunicationThreadByIdForTenant(
  tenantId: string,
  threadId: string,
): Promise<CommunicationThreadRecord | null> {
  assertTenantId(tenantId);
  return getThreadForTenantOrNull(tenantId, threadId);
}

export async function getCommunicationThreadForTarget(
  tenantSlug: string,
  targetType: CommunicationTargetType,
  targetId: string,
): Promise<CommunicationThreadRecord | null> {
  const tenant = await requireTenant(tenantSlug);

  await resolveCommunicationTargetForTenant({
    tenantId: tenant.id,
    targetType,
    targetId,
  });

  return prisma.communicationThread.findFirst({
    where: {
      tenantId: tenant.id,
      targetType,
      targetId,
    },
    select: threadSelect,
  });
}

export async function getOrCreateCommunicationThreadForTarget(
  tenantSlug: string,
  targetType: CommunicationTargetType,
  targetId: string,
  createdByUserId: string | null = null,
): Promise<CommunicationThreadRecord> {
  const tenant = await requireTenant(tenantSlug);

  await resolveCommunicationTargetForTenant({
    tenantId: tenant.id,
    targetType,
    targetId,
  });

  const existing = await prisma.communicationThread.findFirst({
    where: {
      tenantId: tenant.id,
      targetType,
      targetId,
    },
    select: threadSelect,
  });

  if (existing) {
    return existing;
  }

  return prisma.communicationThread.create({
    data: {
      tenantId: tenant.id,
      targetType,
      targetId,
      inboundReplyToken: generateInboundReplyToken(),
      createdByUserId,
    },
    select: threadSelect,
  });
}

export async function requireCommunicationThreadForTenant(
  tenantId: string,
  threadId: string,
): Promise<CommunicationThreadRecord> {
  const thread = await getThreadForTenantOrNull(tenantId, threadId);
  if (!thread) {
    throw new CommunicationServiceError(
      "THREAD_NOT_FOUND",
      "Kommunikations-Thread nicht gefunden oder gehört zu einem anderen Mandanten.",
    );
  }
  return thread;
}

/**
 * Resolves a thread by opaque inbound reply token — tenant-scoped for future
 * webhook processing (COMM-01D). Never resolves globally by token alone.
 */
export async function getCommunicationThreadByInboundTokenForTenant(
  tenantId: string,
  inboundReplyToken: string,
): Promise<CommunicationThreadRecord | null> {
  assertTenantId(tenantId);
  const token = inboundReplyToken.trim();
  if (!token) {
    throw new CommunicationServiceError("INVALID_INPUT", "inboundReplyToken ist erforderlich.");
  }

  return prisma.communicationThread.findFirst({
    where: { tenantId, inboundReplyToken: token },
    select: threadSelect,
  });
}

/**
 * Resolves a thread by inbound reply token without trusting tenant context.
 * The token is cryptographically strong and globally unique in the DB.
 *
 * Used for inbound webhook routing: tenantId is derived from the resolved thread.
 */
export async function getCommunicationThreadByInboundToken(
  inboundReplyToken: string,
): Promise<CommunicationThreadRecord | null> {
  const token = inboundReplyToken.trim();
  if (!token) {
    throw new CommunicationServiceError("INVALID_INPUT", "inboundReplyToken ist erforderlich.");
  }

  return prisma.communicationThread.findFirst({
    where: { inboundReplyToken: token },
    select: threadSelect,
  });
}

/**
 * Ensures a thread uses a reply token that survives common email address
 * normalization (lower-case hex). Safe because inbound reply tokens are not
 * exposed in any existing outbound emails before COMM-02.
 */
export async function ensureStableInboundReplyTokenForThread(
  tenantId: string,
  threadId: string,
): Promise<CommunicationThreadRecord> {
  const thread = await requireCommunicationThreadForTenant(tenantId, threadId);
  if (isStableInboundReplyToken(thread.inboundReplyToken)) {
    return thread;
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextToken = generateInboundReplyToken();
    if (!isStableInboundReplyToken(nextToken)) {
      continue;
    }

    try {
      const updated = await prisma.communicationThread.update({
        where: { id: thread.id },
        data: { inboundReplyToken: nextToken },
        select: threadSelect,
      });
      return updated;
    } catch (err) {
      // Extremely unlikely: unique collision. Retry.
      if (attempt === 2) throw err;
    }
  }

  // Should be unreachable.
  return requireCommunicationThreadForTenant(tenantId, threadId);
}
