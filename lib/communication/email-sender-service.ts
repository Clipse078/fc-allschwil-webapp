import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import {
  getSenderDomainAuthorization,
  type SenderDomainAuthorization,
} from "@/lib/email/mailer";
import { assertTenantId } from "@/lib/communication/errors";

export const MAX_EMAIL_SENDER_DISPLAY_NAME_LENGTH = 120;
export const MAX_EMAIL_SENDER_ADDRESS_LENGTH = 320;

const unsafeHeaderCharacter = /[\p{Cc}\p{Cf}<>"\\]/u;
const senderEmailSchema = z.string().email();

export type EmailSenderProviderStatus =
  | SenderDomainAuthorization
  | "NOT_CONFIGURED";

export type TenantEmailSenderSettings = {
  displayName: string | null;
  emailAddress: string | null;
  providerStatus: EmailSenderProviderStatus;
  activeSource: "TENANT" | "PLATFORM";
  activeFrom: string;
  platformFallbackActive: boolean;
};

export type ResolvedTenantEmailSender = {
  displayName: string;
  emailAddress: string;
  formattedFrom: string;
  source: "TENANT" | "PLATFORM";
  providerStatus: EmailSenderProviderStatus;
};

export class EmailSenderSettingsError extends Error {
  constructor(
    readonly code: "INVALID_INPUT" | "TENANT_NOT_FOUND",
    message: string,
    readonly field?: "displayName" | "emailAddress",
  ) {
    super(message);
    this.name = "EmailSenderSettingsError";
  }
}

function requirePlatformFrom(): string {
  const from = process.env.EMAIL_FROM?.trim();
  if (!from) {
    throw new Error("EMAIL_FROM is not configured.");
  }
  return from;
}

function parseFormattedFrom(from: string): { displayName: string; emailAddress: string } {
  const match = from.match(/^\s*(.*?)\s*<([^<>]+)>\s*$/);
  if (match) {
    return {
      displayName: match[1]?.trim() || match[2]!.trim(),
      emailAddress: match[2]!.trim().toLowerCase(),
    };
  }
  return { displayName: from, emailAddress: from.toLowerCase() };
}

export function validateTenantEmailSenderInput(input: {
  displayName: unknown;
  emailAddress: unknown;
}): { displayName: string; emailAddress: string } {
  if (typeof input.displayName !== "string") {
    throw new EmailSenderSettingsError(
      "INVALID_INPUT",
      "Absendername ist erforderlich.",
      "displayName",
    );
  }

  if (unsafeHeaderCharacter.test(input.displayName)) {
    throw new EmailSenderSettingsError(
      "INVALID_INPUT",
      "Absendername enthält unzulässige Zeichen.",
      "displayName",
    );
  }

  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new EmailSenderSettingsError(
      "INVALID_INPUT",
      "Absendername ist erforderlich.",
      "displayName",
    );
  }
  if (displayName.length > MAX_EMAIL_SENDER_DISPLAY_NAME_LENGTH) {
    throw new EmailSenderSettingsError(
      "INVALID_INPUT",
      `Absendername darf höchstens ${MAX_EMAIL_SENDER_DISPLAY_NAME_LENGTH} Zeichen enthalten.`,
      "displayName",
    );
  }
  if (typeof input.emailAddress !== "string") {
    throw new EmailSenderSettingsError(
      "INVALID_INPUT",
      "Absender-E-Mail ist erforderlich.",
      "emailAddress",
    );
  }

  if (unsafeHeaderCharacter.test(input.emailAddress)) {
    throw new EmailSenderSettingsError(
      "INVALID_INPUT",
      "Bitte geben Sie eine gültige Absender-E-Mail ein.",
      "emailAddress",
    );
  }

  const emailAddress = input.emailAddress.trim().toLowerCase();
  if (
    !emailAddress ||
    emailAddress.length > MAX_EMAIL_SENDER_ADDRESS_LENGTH ||
    !senderEmailSchema.safeParse(emailAddress).success
  ) {
    throw new EmailSenderSettingsError(
      "INVALID_INPUT",
      "Bitte geben Sie eine gültige Absender-E-Mail ein.",
      "emailAddress",
    );
  }

  return { displayName, emailAddress };
}

export function formatEmailSender(displayName: string, emailAddress: string): string {
  return `${displayName} <${emailAddress}>`;
}

export async function getTenantEmailSenderSettings(
  inputTenantId: string,
): Promise<TenantEmailSenderSettings> {
  const tenantId = assertTenantId(inputTenantId);
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: {
      emailSenderDisplayName: true,
      emailSenderAddress: true,
    },
  });
  if (!tenant) {
    throw new EmailSenderSettingsError("TENANT_NOT_FOUND", "Mandant nicht gefunden.");
  }

  const displayName = tenant.emailSenderDisplayName?.trim() || null;
  const emailAddress = tenant.emailSenderAddress?.trim().toLowerCase() || null;
  const providerStatus: EmailSenderProviderStatus =
    displayName && emailAddress
      ? await getSenderDomainAuthorization(emailAddress)
      : "NOT_CONFIGURED";
  const tenantUsable = !!displayName && !!emailAddress && providerStatus === "VERIFIED";
  const platformFrom = requirePlatformFrom();

  return {
    displayName,
    emailAddress,
    providerStatus,
    activeSource: tenantUsable ? "TENANT" : "PLATFORM",
    activeFrom: tenantUsable
      ? formatEmailSender(displayName, emailAddress)
      : platformFrom,
    platformFallbackActive: !tenantUsable,
  };
}

export async function resolveTenantEmailSender(
  tenantId: string,
): Promise<ResolvedTenantEmailSender> {
  const settings = await getTenantEmailSenderSettings(tenantId);
  const active = parseFormattedFrom(settings.activeFrom);
  return {
    ...active,
    formattedFrom: settings.activeFrom,
    source: settings.activeSource,
    providerStatus: settings.providerStatus,
  };
}

export async function updateTenantEmailSenderSettings(input: {
  tenantId: string;
  actorUserId: string;
  displayName: unknown;
  emailAddress: unknown;
}): Promise<TenantEmailSenderSettings> {
  const tenantId = assertTenantId(input.tenantId);
  const actorUserId = input.actorUserId.trim();
  const values = validateTenantEmailSenderInput(input);

  const existing = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { id: true },
  });
  if (!existing) {
    throw new EmailSenderSettingsError("TENANT_NOT_FOUND", "Mandant nicht gefunden.");
  }

  const updated = await prisma.tenant.updateMany({
    where: { id: tenantId },
    data: {
      emailSenderDisplayName: values.displayName,
      emailSenderAddress: values.emailAddress,
    },
  });
  if (updated.count !== 1) {
    throw new EmailSenderSettingsError("TENANT_NOT_FOUND", "Mandant nicht gefunden.");
  }

  await logAction({
    tenantId,
    actorUserId: actorUserId || null,
    moduleKey: "communications",
    entityType: "TenantEmailSenderSettings",
    entityId: tenantId,
    action: "UPDATE",
    metadataJson: {
      changedFields: ["emailSenderDisplayName", "emailSenderAddress"],
    },
  });

  return getTenantEmailSenderSettings(tenantId);
}
