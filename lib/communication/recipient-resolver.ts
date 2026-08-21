/**
 * COMM-01C: Canonical, tenant-safe external recipient resolution.
 *
 * Target ownership is always proven through resolveCommunicationTargetForTenant
 * before recipient or lifecycle data is read.
 */
import type { CommunicationTargetType } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { CommunicationServiceError, assertTenantId } from "@/lib/communication/errors";
import { resolveCommunicationTargetForTenant } from "@/lib/communication/target-resolver";

const recipientEmailSchema = z.string().trim().max(320).email();
const TERMINAL_REGISTRATION_STATUSES = new Set(["ACCEPTED", "REJECTED", "ARCHIVED"]);
const TERMINAL_WAITING_LIST_STATUSES = new Set(["PLACED", "WITHDRAWN", "REJECTED", "ARCHIVED"]);

export type CommunicationRecipient = {
  email: string | null;
  displayName: string;
  available: boolean;
  sendAllowed: boolean;
  unavailableReason: string | null;
};

function normalizeRecipient(
  email: string | null | undefined,
  displayName: string,
  sendAllowed: boolean,
): CommunicationRecipient {
  const parsed = recipientEmailSchema.safeParse(email);
  const available = parsed.success;
  const unavailableReason = !available
    ? "Für diese Person ist keine gültige E-Mail-Adresse verfügbar."
    : !sendAllowed
      ? "Dieser Eintrag ist abgeschlossen. Der E-Mail-Verlauf bleibt lesbar, neue Nachrichten können nicht gesendet werden."
      : null;

  return {
    email: available ? parsed.data.toLowerCase() : null,
    displayName: displayName.trim() || "Empfänger/in",
    available,
    sendAllowed: available && sendAllowed,
    unavailableReason,
  };
}

export async function resolveCommunicationRecipientForTarget(input: {
  tenantId: string;
  targetType: CommunicationTargetType;
  targetId: string;
}): Promise<CommunicationRecipient> {
  const tenantId = assertTenantId(input.tenantId);
  const target = await resolveCommunicationTargetForTenant({
    tenantId,
    targetType: input.targetType,
    targetId: input.targetId,
  });

  if (target.targetType === "REGISTRATION") {
    const registration = await prisma.registration.findFirst({
      where: { id: target.targetId, tenantId },
      select: { firstName: true, lastName: true, email: true, status: true },
    });
    if (!registration) {
      throw new CommunicationServiceError("TARGET_NOT_FOUND", "Anmeldung nicht gefunden.");
    }

    return normalizeRecipient(
      registration.email,
      `${registration.firstName} ${registration.lastName}`,
      !TERMINAL_REGISTRATION_STATUSES.has(registration.status),
    );
  }

  if (target.targetType === "WAITING_LIST_ENTRY") {
    const entry = await prisma.waitingListEntry.findFirst({
      where: {
        id: target.targetId,
        tenantId,
        registration: { tenantId },
      },
      select: {
        status: true,
        registration: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });
    if (!entry) {
      throw new CommunicationServiceError("TARGET_NOT_FOUND", "Wartelisten-Eintrag nicht gefunden.");
    }

    return normalizeRecipient(
      entry.registration.email,
      `${entry.registration.firstName} ${entry.registration.lastName}`,
      !TERMINAL_WAITING_LIST_STATUSES.has(entry.status),
    );
  }

  throw new CommunicationServiceError(
    "UNSUPPORTED_TARGET_TYPE",
    `Kommunikationsziel ${target.targetType} wird noch nicht unterstützt.`,
  );
}
