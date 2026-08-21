/**
 * lib/communication/message-service.ts
 *
 * COMM-01A: Tenant-scoped communication message persistence.
 * No real email is sent in this slice — persistence/domain groundwork only.
 */

import type {
  CommunicationMessageChannel,
  CommunicationMessageDirection,
  CommunicationMessageStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenants/require-tenant";
import { CommunicationServiceError, assertTenantId } from "@/lib/communication/errors";
import {
  getCommunicationThreadForTarget,
  requireCommunicationThreadForTenant,
} from "@/lib/communication/thread-service";
import type { CommunicationTargetType } from "@prisma/client";

const messageSelect = {
  id: true,
  tenantId: true,
  threadId: true,
  direction: true,
  channel: true,
  subject: true,
  bodyText: true,
  bodyHtml: true,
  fromAddress: true,
  toAddresses: true,
  provider: true,
  providerMessageId: true,
  messageIdHeader: true,
  inReplyTo: true,
  references: true,
  status: true,
  sentAt: true,
  receivedAt: true,
  createdByUserId: true,
  createdAt: true,
  updatedAt: true,
} as const;

export type CommunicationMessageRecord = Prisma.CommunicationMessageGetPayload<{
  select: typeof messageSelect;
}>;

export type CreateCommunicationMessageInput = {
  direction: CommunicationMessageDirection;
  channel?: CommunicationMessageChannel;
  subject?: string | null;
  bodyText?: string | null;
  bodyHtml?: string | null;
  fromAddress?: string | null;
  toAddresses?: string[] | null;
  provider?: string | null;
  providerMessageId?: string | null;
  messageIdHeader?: string | null;
  inReplyTo?: string | null;
  references?: string[] | null;
  status?: CommunicationMessageStatus;
  sentAt?: Date | null;
  receivedAt?: Date | null;
};

export async function listCommunicationMessages(
  tenantId: string,
  threadId: string,
): Promise<CommunicationMessageRecord[]> {
  assertTenantId(tenantId);
  await requireCommunicationThreadForTenant(tenantId, threadId);

  return prisma.communicationMessage.findMany({
    where: { tenantId, threadId },
    select: messageSelect,
    orderBy: { createdAt: "asc" },
  });
}

export async function getCommunicationMessageByIdForTenant(
  tenantId: string,
  messageId: string,
): Promise<CommunicationMessageRecord | null> {
  assertTenantId(tenantId);
  return prisma.communicationMessage.findFirst({
    where: { id: messageId, tenantId },
    select: messageSelect,
  });
}

export async function createCommunicationMessage(
  tenantId: string,
  threadId: string,
  input: CreateCommunicationMessageInput,
  createdByUserId: string | null = null,
): Promise<CommunicationMessageRecord> {
  assertTenantId(tenantId);
  await requireCommunicationThreadForTenant(tenantId, threadId);

  return prisma.communicationMessage.create({
    data: {
      tenantId,
      threadId,
      direction: input.direction,
      channel: input.channel ?? "EMAIL",
      subject: input.subject ?? null,
      bodyText: input.bodyText ?? null,
      bodyHtml: input.bodyHtml ?? null,
      fromAddress: input.fromAddress ?? null,
      toAddresses: input.toAddresses ?? undefined,
      provider: input.provider ?? null,
      providerMessageId: input.providerMessageId ?? null,
      messageIdHeader: input.messageIdHeader ?? null,
      inReplyTo: input.inReplyTo ?? null,
      references: input.references ?? undefined,
      status: input.status ?? "DRAFT",
      sentAt: input.sentAt ?? null,
      receivedAt: input.receivedAt ?? null,
      createdByUserId,
    },
    select: messageSelect,
  });
}

/**
 * Tenant-scoped provider identifier lookup for future inbound webhook handling.
 * Never resolves a message outside the resolved tenant boundary.
 */
export async function getCommunicationMessageByProviderIdForTenant(
  tenantId: string,
  provider: string,
  providerMessageId: string,
): Promise<CommunicationMessageRecord | null> {
  assertTenantId(tenantId);
  const normalizedProvider = provider.trim();
  const normalizedProviderMessageId = providerMessageId.trim();

  if (!normalizedProvider || !normalizedProviderMessageId) {
    throw new CommunicationServiceError(
      "INVALID_INPUT",
      "provider und providerMessageId sind erforderlich.",
    );
  }

  return prisma.communicationMessage.findFirst({
    where: {
      tenantId,
      provider: normalizedProvider,
      providerMessageId: normalizedProviderMessageId,
    },
    select: messageSelect,
  });
}

export async function listCommunicationMessagesForTarget(
  tenantSlug: string,
  targetType: CommunicationTargetType,
  targetId: string,
): Promise<CommunicationMessageRecord[]> {
  const tenant = await requireTenant(tenantSlug);
  const thread = await getCommunicationThreadForTarget(tenantSlug, targetType, targetId);

  if (!thread) {
    return [];
  }

  return listCommunicationMessages(tenant.id, thread.id);
}
