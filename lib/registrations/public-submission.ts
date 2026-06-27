/**
 * lib/registrations/public-submission.ts
 *
 * Business logic for website-originated registration submissions.
 *
 * Responsibilities:
 *   - Validate the public payload
 *   - Map public type strings to internal RegistrationType
 *   - Detect probable duplicates (soft warning, never blocks)
 *   - Create the Registration record under the correct tenant
 *   - Write an AuditLog entry for the submission
 *
 * This module is intentionally import-safe for use in public API routes:
 * it does NOT import anything that requires an authenticated session.
 */

import { RegistrationType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import type { WebsiteRegistrationPayload } from "@/lib/website/integration-contract";
import { WEBSITE_SOURCE } from "@/lib/registrations/constants";

// Re-export for convenience so callers only need one import point
export { WEBSITE_SOURCE };

/**
 * Window (ms) within which two registrations with the same email are
 * considered a probable duplicate. 1 hour is aggressive enough to catch
 * double-clicks or accidental re-submits without blocking legitimate re-tries.
 */
const DUPLICATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Type mapping
// ---------------------------------------------------------------------------

/**
 * Maps the public-facing registration type string to the internal Prisma enum.
 * New website types introduced in the website-registration-integration slice
 * are mapped first; unrecognised types fall through to OTHER.
 */
export function mapPublicTypeToPrisma(
  publicType: WebsiteRegistrationPayload["type"],
): RegistrationType {
  switch (publicType) {
    case "PLAYER":
      return RegistrationType.SPIELERANMELDUNG;
    case "TRIAL_TRAINING":
      return RegistrationType.PROBETRAINING;
    case "MEMBERSHIP":
      return RegistrationType.MITGLIEDSCHAFT;
    case "COACH":
      return RegistrationType.TRAINERANMELDUNG;
    case "VOLUNTEER":
      return RegistrationType.FREIWILLIGENMELDUNG;
    case "REFEREE":
      return RegistrationType.SCHIEDSRICHTERANMELDUNG;
    case "CAMP":
      return RegistrationType.CAMP_ANMELDUNG;
    case "EVENT":
      return RegistrationType.VERANSTALTUNGSANMELDUNG;
    case "SPONSOR":
      return RegistrationType.SPONSORANFRAGE;
    case "GENERAL":
      return RegistrationType.KONTAKTANFRAGE;
    default:
      return RegistrationType.OTHER;
  }
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ValidationError = { field: string; message: string };

const VALID_TYPES = new Set([
  "PLAYER",
  "TRIAL_TRAINING",
  "MEMBERSHIP",
  "COACH",
  "VOLUNTEER",
  "REFEREE",
  "CAMP",
  "EVENT",
  "SPONSOR",
  "GENERAL",
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Validates the inbound public payload.
 * Returns an array of field-level errors; empty = valid.
 */
export function validatePublicPayload(
  payload: unknown,
): { valid: true; data: WebsiteRegistrationPayload } | { valid: false; errors: ValidationError[] } {
  const errors: ValidationError[] = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { valid: false, errors: [{ field: "body", message: "Ungültiges Anfrage-Format." }] };
  }

  const p = payload as Record<string, unknown>;

  // type
  if (!p.type || !VALID_TYPES.has(p.type as string)) {
    errors.push({
      field: "type",
      message: `Unbekannter Anmeldungstyp. Erlaubt: ${[...VALID_TYPES].join(", ")}`,
    });
  }

  // person
  const person = p.person as Record<string, unknown> | undefined;
  if (!person || typeof person !== "object") {
    errors.push({ field: "person", message: "Personendaten fehlen." });
  } else {
    if (!person.firstName || typeof person.firstName !== "string" || !person.firstName.trim()) {
      errors.push({ field: "person.firstName", message: "Vorname ist erforderlich." });
    }
    if (!person.lastName || typeof person.lastName !== "string" || !person.lastName.trim()) {
      errors.push({ field: "person.lastName", message: "Nachname ist erforderlich." });
    }
    if (!person.email || typeof person.email !== "string") {
      errors.push({ field: "person.email", message: "E-Mail-Adresse ist erforderlich." });
    } else if (!EMAIL_RE.test(person.email.trim())) {
      errors.push({ field: "person.email", message: "E-Mail-Adresse ist ungültig." });
    }
  }

  // consent
  const consent = p.consent as Record<string, unknown> | undefined;
  if (!consent || typeof consent !== "object") {
    errors.push({ field: "consent", message: "Einwilligung fehlt." });
  } else if (consent.privacyAccepted !== true) {
    errors.push({
      field: "consent.privacyAccepted",
      message: "Datenschutzerklärung muss akzeptiert werden.",
    });
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, data: payload as WebsiteRegistrationPayload };
}

// ---------------------------------------------------------------------------
// Duplicate detection
// ---------------------------------------------------------------------------

type DuplicateCheckResult = {
  isPossibleDuplicate: boolean;
  duplicateRegistrationId: string | null;
};

/**
 * Checks for probable duplicate registrations within the last hour for the
 * same tenant.
 *
 * Strategy (soft — never blocks; marks only):
 *   1. Same email + same first+last name (case-insensitive) within 24 hours.
 *   2. Same email within the last hour (catches form double-submits).
 *
 * Returns the ID of the first match found, or null.
 */
export async function checkDuplicate(
  tenantId: string,
  email: string,
  firstName: string,
  lastName: string,
): Promise<DuplicateCheckResult> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - DUPLICATE_WINDOW_MS);
  const oneDayAgo = new Date(now.getTime() - 24 * DUPLICATE_WINDOW_MS);

  // Check 1: same email + name within 24 hours
  const byEmailAndName = await prisma.registration.findFirst({
    where: {
      tenantId,
      email: { equals: email, mode: "insensitive" },
      firstName: { equals: firstName, mode: "insensitive" },
      lastName: { equals: lastName, mode: "insensitive" },
      createdAt: { gte: oneDayAgo },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (byEmailAndName) {
    return { isPossibleDuplicate: true, duplicateRegistrationId: byEmailAndName.id };
  }

  // Check 2: same email within 1 hour
  const byEmailOnly = await prisma.registration.findFirst({
    where: {
      tenantId,
      email: { equals: email, mode: "insensitive" },
      createdAt: { gte: oneHourAgo },
    },
    select: { id: true },
    orderBy: { createdAt: "desc" },
  });

  if (byEmailOnly) {
    return { isPossibleDuplicate: true, duplicateRegistrationId: byEmailOnly.id };
  }

  return { isPossibleDuplicate: false, duplicateRegistrationId: null };
}

// ---------------------------------------------------------------------------
// Main creation function
// ---------------------------------------------------------------------------

export type PublicSubmissionResult = {
  registrationId: string;
  status: "NEW";
  isPossibleDuplicate: boolean;
};

/**
 * Creates a Registration record from a validated public website payload.
 *
 * Flow:
 *   1. Resolve tenant (passed in as pre-resolved tenantId for efficiency).
 *   2. Run soft duplicate check.
 *   3. Create Registration with source = WEBSITE.
 *   4. Write AuditLog entry (best-effort, never throws).
 *   5. Return minimal public-safe result.
 */
export async function createPublicRegistration(
  tenantId: string,
  tenantKey: string,
  payload: WebsiteRegistrationPayload,
): Promise<PublicSubmissionResult> {
  const person = payload.person;
  const firstName = (person.firstName ?? "").trim();
  const lastName = (person.lastName ?? "").trim();
  const email = (person.email ?? "").trim().toLowerCase();

  // Duplicate detection (soft — annotates but does not block)
  const duplicate = await checkDuplicate(tenantId, email, firstName, lastName);

  // Derive birthYear from birthDate if available
  let birthYear: number | null = null;
  let birthDate: Date | null = null;
  if (person.birthDate) {
    const parsed = new Date(person.birthDate);
    if (!isNaN(parsed.getTime())) {
      birthDate = parsed;
      birthYear = parsed.getFullYear();
    }
  }

  // Build the full payload JSON for storage (preserve everything submitted)
  const storedPayload: Record<string, unknown> = {
    type: payload.type,
    source: payload.source ?? WEBSITE_SOURCE,
    locale: payload.locale ?? "de-CH",
    submittedAt: payload.submittedAt ?? new Date().toISOString(),
    person: payload.person,
    consent: payload.consent,
  };
  if (payload.parentOrGuardian) storedPayload.parentOrGuardian = payload.parentOrGuardian;
  if (payload.address) storedPayload.address = payload.address;
  if (payload.football) storedPayload.football = payload.football;
  if (payload.event) storedPayload.event = payload.event;
  if (payload.sponsor) storedPayload.sponsor = payload.sponsor;
  if (payload.message) storedPayload.message = payload.message;
  if (payload.rawData) storedPayload.rawData = payload.rawData;
  if (duplicate.isPossibleDuplicate) {
    storedPayload.possibleDuplicate = true;
    storedPayload.possibleDuplicateOf = duplicate.duplicateRegistrationId;
  }

  // Derive contact name: sponsor contactPerson, parentOrGuardian, or null
  const contactName =
    payload.sponsor?.contactPerson ||
    (payload.parentOrGuardian
      ? `${payload.parentOrGuardian.firstName ?? ""} ${payload.parentOrGuardian.lastName ?? ""}`.trim()
      : null) ||
    null;

  if (contactName) {
    storedPayload.contactName = contactName;
  }

  // Build the message field: concatenate payload.message + football details
  let message = payload.message ?? null;
  if (payload.football?.currentClub) {
    const footballNote = [
      payload.football.currentClub ? `Aktueller Verein: ${payload.football.currentClub}` : null,
      payload.football.previousClub ? `Vorheriger Verein: ${payload.football.previousClub}` : null,
      payload.football.desiredTeam ? `Gewünschtes Team: ${payload.football.desiredTeam}` : null,
      payload.football.position ? `Position: ${payload.football.position}` : null,
      payload.football.preferredTrainingDay
        ? `Bevorzugter Trainingstag: ${payload.football.preferredTrainingDay}`
        : null,
    ]
      .filter(Boolean)
      .join("\n");
    message = [message, footballNote].filter(Boolean).join("\n\n");
  }

  const registration = await prisma.registration.create({
    data: {
      tenantId,
      type: mapPublicTypeToPrisma(payload.type),
      status: "NEW",
      firstName,
      lastName,
      email,
      phone: person.phone?.trim() || null,
      birthDate,
      birthYear,
      message: message ?? null,
      payloadJson: storedPayload as import("@prisma/client").Prisma.InputJsonObject,
      source: WEBSITE_SOURCE,
      submittedAt: payload.submittedAt ? new Date(payload.submittedAt) : new Date(),
    },
    select: { id: true, status: true },
  });

  // Audit log — best-effort, never throws
  void logAction({
    actorUserId: null,
    moduleKey: "registrations",
    entityType: "Registration",
    entityId: registration.id,
    action: "WEBSITE_SUBMISSION",
    afterJson: {
      tenantKey,
      type: payload.type,
      source: WEBSITE_SOURCE,
      email,
      firstName,
      lastName,
      isPossibleDuplicate: duplicate.isPossibleDuplicate,
    },
    metadataJson: {
      locale: payload.locale,
      source: payload.source,
    },
  });

  return {
    registrationId: registration.id,
    status: "NEW",
    isPossibleDuplicate: duplicate.isPossibleDuplicate,
  };
}
