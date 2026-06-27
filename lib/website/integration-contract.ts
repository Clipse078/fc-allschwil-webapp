/**
 * lib/website/integration-contract.ts
 *
 * FC Allschwil Website ↔ SportClubEvo WebApp Integration Contract
 *
 * This file is the single source of truth for the integration interface
 * between the public FC Allschwil website and the SportClubEvo WebApp.
 *
 * The website implementation MUST use these types and endpoints.
 * Do not duplicate this contract on the website side — import it or copy it verbatim.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * REGISTRATION INTAKE
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Endpoint:  POST /api/public/{tenantSlug}/registrations
 * Auth:      None (public, no credentials required)
 * Tenant:    fc-allschwil
 * Rate limit: Server-side (header X-RateLimit-Remaining is set)
 *
 * All website Anmeldungen land directly in the WebApp Registration Inbox.
 * The existing registration workflow (NEW → REVIEWING → ACCEPTED / REJECTED) applies.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * PUBLIC CONTENT ENDPOINTS
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * All require no auth. Tenant slug is path-embedded.
 *
 * GET /api/public/{tenantSlug}/website/homepage
 * GET /api/public/{tenantSlug}/website/navigation
 * GET /api/public/{tenantSlug}/website/news
 * GET /api/public/{tenantSlug}/website/events
 * GET /api/public/{tenantSlug}/website/matches
 * GET /api/public/{tenantSlug}/website/teams
 * GET /api/public/{tenantSlug}/website/teams/{slug}
 * GET /api/public/{tenantSlug}/website/weekplan
 * GET /api/public/{tenantSlug}/website/pages/{slug}/layout
 *
 * All content endpoints return only published, tenant-safe, non-archived content.
 * Draft and unpublished content never leaks publicly.
 */

// ---------------------------------------------------------------------------
// Registration Submission Payload
// ---------------------------------------------------------------------------

/**
 * Public-facing registration type identifiers.
 * These are mapped to internal RegistrationType enum values by the API.
 *
 * Mapping:
 *   PLAYER          → SPIELERANMELDUNG
 *   TRIAL_TRAINING  → PROBETRAINING
 *   MEMBERSHIP      → MITGLIEDSCHAFT
 *   COACH           → TRAINERANMELDUNG
 *   VOLUNTEER       → FREIWILLIGENMELDUNG
 *   REFEREE         → SCHIEDSRICHTERANMELDUNG
 *   CAMP            → CAMP_ANMELDUNG
 *   EVENT           → VERANSTALTUNGSANMELDUNG
 *   SPONSOR         → SPONSORANFRAGE
 *   GENERAL         → KONTAKTANFRAGE
 */
export type WebsiteRegistrationType =
  | "PLAYER"
  | "TRIAL_TRAINING"
  | "MEMBERSHIP"
  | "COACH"
  | "VOLUNTEER"
  | "REFEREE"
  | "CAMP"
  | "EVENT"
  | "SPONSOR"
  | "GENERAL";

export type WebsiteRegistrationPayload = {
  /** Registration type — determines workflow routing and display in inbox. */
  type: WebsiteRegistrationType;

  /**
   * Source identifier.
   * MUST be "FC_ALLSCHWIL_WEBSITE" for FC Allschwil website submissions.
   * Used for audit trail and source display in admin inbox.
   */
  source?: string;

  /** BCP 47 locale tag. Default: "de-CH" */
  locale?: string;

  /** ISO 8601 UTC timestamp of when the form was submitted on the website. */
  submittedAt?: string;

  /** Person being registered (the applicant / child / member). */
  person: {
    firstName?: string;
    lastName?: string;
    /** ISO 8601 date string, e.g. "2015-03-22" */
    birthDate?: string;
    /** "male" | "female" | "other" | "" */
    gender?: string;
    email?: string;
    phone?: string;
  };

  /**
   * Parent or guardian — include for juniors and whenever a responsible
   * adult's contact is different from the person's.
   */
  parentOrGuardian?: {
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  };

  address?: {
    street?: string;
    postalCode?: string;
    city?: string;
    country?: string;
  };

  /** Football-specific fields — include for PLAYER, TRIAL_TRAINING, COACH. */
  football?: {
    currentClub?: string;
    previousClub?: string;
    desiredTeam?: string;
    preferredTrainingDay?: string;
    position?: string;
  };

  /** Event-specific fields — include for EVENT registrations. */
  event?: {
    eventId?: string;
    eventName?: string;
  };

  /** Sponsor-specific fields — include for SPONSOR enquiries. */
  sponsor?: {
    companyName?: string;
    contactPerson?: string;
    website?: string;
  };

  /**
   * Consent block.
   * privacyAccepted: REQUIRED — must be true.
   * communicationAccepted: optional marketing/newsletter consent.
   * photoConsent: optional consent to publish photos.
   */
  consent: {
    privacyAccepted: boolean;
    communicationAccepted?: boolean;
    photoConsent?: boolean;
  };

  /** Free-form message from the applicant. */
  message?: string;

  /**
   * Honeypot field — must be absent or empty string.
   * Bots that fill all fields will populate this; humans will not.
   * The API silently returns success for honeypot-triggered submissions
   * without creating a record.
   */
  _hp?: string;

  /**
   * Idempotency key — optional UUID or similar.
   * If supplied, the API will attempt to deduplicate by this key.
   * Use a stable key per form session (e.g. UUID generated on mount).
   */
  idempotencyKey?: string;

  /**
   * Catch-all for any additional form fields not explicitly typed above.
   * All data is preserved in the registration's payloadJson field.
   * Nothing is discarded.
   */
  rawData?: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Registration Submission Response
// ---------------------------------------------------------------------------

export type WebsiteRegistrationSuccessResponse = {
  ok: true;
  registrationId: string;
  status: "NEW";
  message: string;
};

export type WebsiteRegistrationErrorResponse = {
  ok: false;
  error: string;
  /** Field-level validation errors (422 only). */
  errors?: Array<{ field: string; message: string }>;
};

export type WebsiteRegistrationResponse =
  | WebsiteRegistrationSuccessResponse
  | WebsiteRegistrationErrorResponse;

// ---------------------------------------------------------------------------
// Public Content Response Envelope
// ---------------------------------------------------------------------------

/**
 * Standard envelope wrapping all public website content API responses.
 *
 * Shape: { version, tenant, generatedAt, data, meta }
 */
export type WebsiteContentEnvelope<T = unknown> = {
  version: "1";
  tenant: { key: string; name: string };
  generatedAt: string;
  data: T;
  meta: Record<string, unknown>;
};

// ---------------------------------------------------------------------------
// Integration Notes
// ---------------------------------------------------------------------------

/**
 * TENANT SLUG
 *   Use "fc-allschwil" as {tenantSlug} for all FC Allschwil requests.
 *
 * CORS
 *   Public API endpoints allow GET + POST from any origin.
 *   No credentials are sent or required.
 *
 * RATE LIMITING
 *   The POST /registrations endpoint enforces per-IP rate limiting.
 *   On 429 responses, respect the Retry-After header.
 *
 * ERROR HANDLING
 *   4xx errors include { ok: false, error: string }.
 *   5xx errors must be handled gracefully on the website side.
 *   Never expose raw error details to end users.
 *
 * SPAM PROTECTION
 *   Include _hp (honeypot) as a hidden field in all forms.
 *   Leave it empty in your form HTML — bots will fill it.
 *   The API discards honeypot-triggered submissions silently.
 *
 * DUPLICATE PREVENTION
 *   Use idempotencyKey (a UUID generated on form mount) to prevent
 *   accidental double-submissions. The API will return success for
 *   a repeated key without creating a second record.
 *
 * PUBLISHED CONTENT ONLY
 *   All GET /website/* endpoints return only published, non-archived,
 *   tenant-scoped content. Drafts and scheduled-but-not-yet-due items
 *   are never returned.
 */
