import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenants/require-tenant";
import { logAction } from "@/lib/audit/log-action";

const emailSchema = z.string().trim().max(320).email();

export async function updateRegistrationContactEmailForTenant(
  tenantSlug: string,
  registrationId: string,
  email: string,
  actorUserId: string | null = null,
) {
  const tenant = await requireTenant(tenantSlug);
  const parsed = emailSchema.safeParse(email);
  if (!parsed.success) {
    throw new Error("Bitte gib eine gültige E-Mail-Adresse ein.");
  }
  const normalizedEmail = parsed.data.toLowerCase();

  const existing = await prisma.registration.findFirst({
    where: { id: registrationId, tenantId: tenant.id },
    select: { id: true, email: true },
  });
  if (!existing) {
    throw new Error("Anmeldung nicht gefunden.");
  }

  if (existing.email === normalizedEmail) {
    return { id: existing.id, email: existing.email };
  }

  const updated = await prisma.registration.update({
    where: { id: existing.id },
    data: { email: normalizedEmail },
    select: { id: true, email: true },
  });

  // Do not store personal email values in the audit trail; only record that the
  // authoritative contact email changed.
  void logAction({
    actorUserId,
    moduleKey: "registrations",
    entityType: "Registration",
    entityId: updated.id,
    action: "CONTACT_EMAIL_UPDATED",
    afterJson: { changed: true },
    metadataJson: { tenantSlug },
  });

  return updated;
}

