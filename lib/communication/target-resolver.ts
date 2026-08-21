/**
 * lib/communication/target-resolver.ts
 *
 * COMM-01A: Canonical target-resolution / ownership-validation for communication
 * threads. Every thread creation or target-scoped access must pass through here
 * first — never perform a global raw-ID lookup without tenant boundary.
 */

import type { CommunicationTargetType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { CommunicationServiceError, assertTenantId } from "@/lib/communication/errors";

export type ResolvedCommunicationTarget = {
  targetType: CommunicationTargetType;
  targetId: string;
  label: string;
};

export type ResolveCommunicationTargetInput = {
  tenantId: string;
  targetType: CommunicationTargetType;
  targetId: string;
};

const SUPPORTED_TARGET_TYPES: CommunicationTargetType[] = [
  "REGISTRATION",
  "WAITING_LIST_ENTRY",
];

export function isSupportedCommunicationTargetType(
  targetType: CommunicationTargetType,
): boolean {
  return SUPPORTED_TARGET_TYPES.includes(targetType);
}

/**
 * Validates that the target exists inside the tenant boundary and returns
 * minimal metadata for audit/display hooks.
 */
export async function resolveCommunicationTargetForTenant(
  input: ResolveCommunicationTargetInput,
): Promise<ResolvedCommunicationTarget> {
  const tenantId = assertTenantId(input.tenantId);
  const targetId = input.targetId.trim();

  if (!targetId) {
    throw new CommunicationServiceError("INVALID_INPUT", "targetId ist erforderlich.");
  }

  if (!isSupportedCommunicationTargetType(input.targetType)) {
    throw new CommunicationServiceError(
      "UNSUPPORTED_TARGET_TYPE",
      `Kommunikationsziel ${input.targetType} wird noch nicht unterstützt.`,
    );
  }

  if (input.targetType === "REGISTRATION") {
    const registration = await prisma.registration.findFirst({
      where: { id: targetId, tenantId },
      select: { id: true, firstName: true, lastName: true, email: true },
    });

    if (!registration) {
      throw new CommunicationServiceError(
        "TARGET_NOT_FOUND",
        "Anmeldung nicht gefunden oder gehört zu einem anderen Mandanten.",
      );
    }

    return {
      targetType: input.targetType,
      targetId: registration.id,
      label: `${registration.firstName} ${registration.lastName} <${registration.email}>`,
    };
  }

  if (input.targetType === "WAITING_LIST_ENTRY") {
    const entry = await prisma.waitingListEntry.findFirst({
      where: { id: targetId, tenantId },
      select: {
        id: true,
        registration: {
          select: { firstName: true, lastName: true, email: true },
        },
      },
    });

    if (!entry) {
      throw new CommunicationServiceError(
        "TARGET_NOT_FOUND",
        "Wartelisten-Eintrag nicht gefunden oder gehört zu einem anderen Mandanten.",
      );
    }

    const { firstName, lastName, email } = entry.registration;
    return {
      targetType: input.targetType,
      targetId: entry.id,
      label: `${firstName} ${lastName} <${email}>`,
    };
  }

  throw new CommunicationServiceError(
    "UNSUPPORTED_TARGET_TYPE",
    `Kommunikationsziel ${input.targetType} wird noch nicht unterstützt.`,
  );
}
