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
 * DESIGN SYSTEM (CMS V4.1)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * The Design System is the single source of visual truth for all renderers.
 * Every renderer resolves its typography, buttons, cards, colours, shadows,
 * radius and spacing through the Design System — never via hardcoded Tailwind.
 *
 * TOKEN RESOLUTION ORDER
 *   1. Local _layout override (section-level, managed by resolveLayout())
 *   2. Tenant Design System overrides (future: per-tenant DB customisation)
 *   3. DEFAULT_DESIGN_SYSTEM baseline (lib/cms/design-system.ts)
 *   4. Framework fallback (Tailwind utility defaults)
 *
 * RENDERER RESPONSIBILITIES
 *   - Outer shell (width, spacing, background, theme): SectionShell
 *   - Visual token resolution: resolveDesignSystem()
 *   - Block content: block-specific renderer (HeroRenderer, etc.)
 *   Renderers MUST NOT hardcode typography, shadow, radius, card or button styles.
 *
 * USAGE
 *   import { resolveDesignSystem, DEFAULT_DESIGN_SYSTEM } from
 *     "@/lib/website/integration-contract";
 *
 *   const ds = resolveDesignSystem();
 *   <h2 className={`${ds.typography.h2} ${themeTokens.text}`}>{headline}</h2>
 *   <a className={`${ds.buttons.primary} ${ds.buttons.rounded}`}>CTA</a>
 *
 * REFERENCE RENDERERS
 *   All renderers live in components/website/blocks/:
 *   - HeroRenderer.tsx               hero block
 *   - CallToActionRenderer.tsx        callToAction block
 *   - SplitContentCardsRenderer.tsx   splitContentCards block
 *   - NewsTeaserRenderer.tsx          newsTeaser block (data-driven)
 *   - TeamsTeaserRenderer.tsx         teamsTeaser block (data-driven)
 *   - SponsorsTeaserRenderer.tsx      sponsorsTeaser block (foundation-ready)
 *   - EventsTeaserRenderer.tsx        eventsTeaser block (data-driven)
 *   - WeekplanTeaserRenderer.tsx      weekplanTeaser block (data-driven)
 *
 *   SECTION DISPATCHER
 *   components/website/WebsiteSectionDispatcher.tsx maps every registered block
 *   type to its renderer. The public website may use this dispatcher directly
 *   instead of maintaining its own switch/map.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * FLEXIBLE LAYOUT SYSTEM (CMS V2 → V3)
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * Every section returned by the homepage and page-layout endpoints may include
 * a `config._layout` field of type `SectionLayout`. This field drives:
 *   - Container width (narrow / normal / wide / full)
 *   - Vertical spacing (padding top / bottom)
 *   - Colour scheme / tenant theme (light / soft / dark / club)
 *   - Horizontal alignment (left / center / right)
 *   - Column grid (single / 50-50 / 33-66 / 66-33 / 25-75 / 75-25)
 *   - Background (none / solid colour / gradient / DAM image + overlay)
 *   - Responsive stacking rules
 *
 * The `_layout` field is OPTIONAL — sections without it should render with the
 * defaults from DEFAULT_SECTION_LAYOUT (see below). This ensures backward
 * compatibility with pre-migration data.
 *
 * RENDERING IMPLEMENTATION
 *   Reference implementation: `components/website/SectionShell.tsx` in the
 *   WebApp repository. Copy or adapt this component for the public website.
 *   It consumes `SectionLayout` and renders the outer <section> wrapper with
 *   all layout styles applied. Block-specific renderers (e.g.
 *   `components/website/blocks/SplitContentCardsRenderer.tsx`) use SectionShell
 *   as their outermost wrapper.
 *
 *   `resolveLayout(partial?)` merges a (possibly undefined or partial)
 *   SectionLayout with DEFAULT_SECTION_LAYOUT and returns a fully-populated
 *   layout object safe to use in a renderer.
 *
 * BACKWARD COMPATIBILITY
 *   `splitContentCards` sections created before the Flexible Layout System
 *   store their layout under `config.style` and `config.background` (legacy).
 *   Both the WebApp renderer and any public website renderer MUST fall back to
 *   those fields when `config._layout` is absent. See `resolveBlockLayout()`
 *   in `components/website/blocks/SplitContentCardsRenderer.tsx`.
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
 * GET /api/public/{tenantSlug}/website/components/{id}
 * GET /api/public/{tenantSlug}/website/media/{id}
 * GET /api/public/{tenantSlug}/website/sponsors
 * GET /api/public/{tenantSlug}/website/design-system
 *
 * All content endpoints return only published, tenant-safe, non-archived content.
 * Draft and unpublished content never leaks publicly.
 *
 * REUSABLE COMPONENTS
 *   GET /api/public/{tenantSlug}/website/components/{id}
 *   Returns a single published reusable component by id.
 *   Visibility: publishStatus=PUBLISHED or scheduledPublishAt<=now(), archivedAt=null.
 *   ANNOUNCEMENT type: also enforces config.publishFrom / config.publishUntil window.
 *   Response: { version, tenant, generatedAt, data: { component }, meta }
 *   component: { id, type, title, config, updatedAt }
 *
 * DAM MEDIA
 *   GET /api/public/{tenantSlug}/website/media/{id}
 *   Returns public-safe metadata for a single ACTIVE media asset.
 *   storageKey and all admin-only fields are never exposed.
 *   Response: { version, tenant, generatedAt, data: { asset }, meta }
 *   asset: { id, url, altText, caption, width, height, mimeType }
 *
 * SPONSORS
 *   GET /api/public/{tenantSlug}/website/sponsors
 *   Placeholder — no Sponsor entity exists yet.
 *   Returns { sponsors: [] } with _contract metadata explaining the status.
 *   Individual sponsor blocks are available via SPONSOR_BANNER ReusableComponents.
 *   Response shape is forward-compatible: will be populated once Sponsor model is added.
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
// Reusable Component — public shape
// ---------------------------------------------------------------------------

/**
 * Public-safe reusable component shape.
 * Returned by GET /api/public/{tenantSlug}/website/components/{id}.
 *
 * Intentionally omits: publishStatus, scheduledPublishAt, archivedAt,
 * approvalStatus, reviewerUserId, approvalNote, createdByUserId, slug,
 * description, and all other admin-only workflow fields.
 */
export type WebsitePublicComponent = {
  id: string;
  /** Component type key, e.g. "CTA", "SPONSOR_BANNER", "ANNOUNCEMENT". */
  type: string;
  /** Admin-configured human-readable title. */
  title: string;
  /** Type-specific configuration. Keys vary by type — treat unknown keys as extras. */
  config: Record<string, unknown>;
  /** ISO 8601 timestamp of the last admin update. */
  updatedAt: string;
};

export type WebsiteComponentData = {
  component: WebsitePublicComponent;
};

// ---------------------------------------------------------------------------
// DAM Media Asset — public shape
// ---------------------------------------------------------------------------

/**
 * Public-safe media asset shape.
 * Returned by GET /api/public/{tenantSlug}/website/media/{id}.
 *
 * Intentionally omits: storageKey, createdByUserId, tenantId, folderId,
 * tags, copyright, photographer, description, sizeBytes, type (asset type),
 * filename, durationSec, createdAt, updatedAt, archivedAt.
 */
export type WebsitePublicMediaAsset = {
  id: string;
  /** Publicly accessible CDN / blob URL. */
  url: string;
  /** Alt text for accessibility. Null when not set by editor. */
  altText: string | null;
  /** Editorial caption. Null when not set. */
  caption: string | null;
  /** Image width in pixels. Null for videos or when not stored. */
  width: number | null;
  /** Image height in pixels. Null for videos or when not stored. */
  height: number | null;
  /** MIME type, e.g. "image/webp", "video/mp4". */
  mimeType: string;
};

export type WebsiteMediaData = {
  asset: WebsitePublicMediaAsset;
};

// ---------------------------------------------------------------------------
// Sponsors — public shape (placeholder, no Sponsor model yet)
// ---------------------------------------------------------------------------

/**
 * Placeholder sponsor shape. Populated once the Sponsor entity is implemented.
 *
 * Today GET /api/public/{tenantSlug}/website/sponsors returns an empty list.
 * For individual sponsor blocks, use SPONSOR_BANNER ReusableComponents via
 * GET /api/public/{tenantSlug}/website/components/{id}.
 */
export type WebsitePublicSponsor = {
  id: string;
  name: string;
  logoUrl: string | null;
  websiteUrl: string | null;
  tier: string | null;
};

export type WebsiteSponsorsData = {
  sponsors: WebsitePublicSponsor[];
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

// ---------------------------------------------------------------------------
// Flexible Layout System — SectionLayout types
// ---------------------------------------------------------------------------
// Re-exported from lib/cms/layout-types.ts for public-website consumption.
// Copy these types verbatim into the public website project.
// ---------------------------------------------------------------------------

export type {
  SectionLayout,
  SectionWidth,
  SectionSpacing,
  SectionTheme,
  SectionHAlign,
  SectionVAlign,
  SectionColumns,
  SectionBackground,
  SectionResponsive,
  ThemeTokens,
} from "@/lib/cms/layout-types";

export {
  DEFAULT_SECTION_LAYOUT,
  resolveLayout,
  GRADIENT_PRESETS,
  THEME_TOKENS,
  SPACING_TOP_MAP,
  SPACING_BOTTOM_MAP,
  PADDING_X_MAP,
  WIDTH_MAP,
} from "@/lib/cms/layout-types";

// ---------------------------------------------------------------------------
// Design System — CMS V4.1 Tailwind token layer (internal renderer tokens)
// ---------------------------------------------------------------------------
// Re-exported from lib/cms/design-system and lib/cms/token-resolver.
// These are Tailwind class-string tokens used by internal block renderers.
// Names that conflict with the CMS V4 website types below are exported with
// a "Cms" prefix to avoid duplicate identifier errors.
// ---------------------------------------------------------------------------

export type {
  DesignSystemTokens,
  TypographyTokens,
  TypographyTokenKey,
  ButtonTokens as CmsButtonTokens,
  ButtonVariantKey,
  ButtonShapeKey,
  CardTokens as CmsCardTokens,
  CardStyleKey,
  ColorTokens,
  ColorTokenKey,
  SpacingTokens,
  SpacingTokenKey,
  ShadowTokens as CmsShadowTokens,
  ShadowTokenKey,
  RadiusTokens as CmsRadiusTokens,
  RadiusTokenKey,
  SectionWidthTokens as CmsSectionWidthTokens,
  SectionWidthTokenKey,
} from "@/lib/cms/design-system";

export type { DesignSystemOverrides } from "@/lib/cms/token-resolver";

export {
  DEFAULT_DESIGN_SYSTEM as CMS_DEFAULT_DESIGN_SYSTEM,
  TYPOGRAPHY_TOKENS,
  BUTTON_TOKENS,
  CARD_TOKENS,
  COLOR_TOKENS,
  SPACING_TOKENS,
  SHADOW_TOKENS,
  RADIUS_TOKENS,
  SECTION_WIDTH_TOKENS,
} from "@/lib/cms/design-system";

export { resolveDesignSystem as cmsResolveDesignSystem } from "@/lib/cms/token-resolver";

// ---------------------------------------------------------------------------
// Design System — CMS V4 Design System Manager (tenant-configurable CSS tokens)
// ---------------------------------------------------------------------------
// Re-exported from lib/website/design-system-types.ts for public-website consumption.
// These are CSS raw-value tokens returned by the /website/design-system endpoint
// and consumed by SectionShell and the public website renderer.
// Copy these types verbatim into the public website project.
// ---------------------------------------------------------------------------

export type {
  TenantDesignSystem,
  ResolvedDesignSystem,
  TypographyToken,
  TypographyScale,
  ColourTokens,
  ButtonTokenStyle,
  ButtonTokens,
  CardTokenStyle,
  CardTokens,
  SpacingScale,
  ShadowTokens,
  RadiusTokens,
  SectionWidthTokens,
  AnimationTokens,
  AnimationPreference,
} from "@/lib/website/design-system-types";

export {
  DEFAULT_DESIGN_SYSTEM,
  resolveDesignSystem,
} from "@/lib/website/design-system-types";

// ---------------------------------------------------------------------------
// CMS section shapes — returned by /homepage and /pages/[slug]/layout
// ---------------------------------------------------------------------------

/**
 * Public-safe block metadata attached to each section.
 * Null for unregistered block types.
 */
export type WebsitePublicBlockMeta = {
  /** Block category for rendering decisions. */
  category:
    | "Header"
    | "Content"
    | "Data-driven"
    | "Club"
    | "Sponsors"
    | "Conversion"
    | "Utility";
  /**
   * Whether this block auto-fetches its own data.
   * false → uses config values only (hero, callToAction, splitContentCards)
   * true  → fetches live data (newsTeaser, eventsTeaser, teamsTeaser, …)
   */
  datadriven: boolean;
};

/**
 * Single CMS section as returned by the public homepage and page-layout APIs.
 *
 * The `config` object contains block-specific fields AND may contain a
 * `_layout` field of type SectionLayout (Flexible Layout System).
 *
 * Rendering contract:
 *   1. Read `config._layout` (may be absent for pre-migration data).
 *   2. Pass it to `resolveLayout()` to get a fully-populated layout.
 *   3. Apply the resolved layout to the outer section wrapper.
 *   4. Render block-specific content inside.
 *
 * For the reference implementation, see:
 *   WebApp: components/website/SectionShell.tsx (outer wrapper)
 *   WebApp: components/website/blocks/SplitContentCardsRenderer.tsx (block example)
 */
export type WebsitePublicSection = {
  /** Stable section ID (CUID). */
  id: string;
  /** Block type key (e.g. "hero", "splitContentCards", "newsTeaser"). */
  type: string;
  /** Admin-configured display label. */
  label: string;
  /** Display order ascending (0-based). */
  sortOrder: number;
  /**
   * Block-specific config including the optional shared layout field.
   *
   * Always check for unknown keys gracefully — new fields may be added.
   * Known cross-cutting key:
   *   config._layout  — SectionLayout (Flexible Layout System). Optional;
   *                     use resolveLayout(config._layout) to get defaults.
   */
  config: Record<string, unknown> & { _layout?: import("@/lib/cms/layout-types").SectionLayout };
  /** Block metadata from the registry. Null for unregistered types. */
  block: WebsitePublicBlockMeta | null;
};

/**
 * Response shape for GET /api/public/[tenant]/website/homepage
 * Access via: envelope.data.sections
 */
export type WebsiteHomepageData = {
  sections: WebsitePublicSection[];
};

/**
 * Page metadata included in the page-layout response.
 */
export type WebsitePublicPageMeta = {
  id: string;
  slug: string;
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
};

/**
 * Response shape for GET /api/public/[tenant]/website/pages/[slug]/layout
 * Access via: envelope.data.page and envelope.data.sections
 */
export type WebsitePageLayoutData = {
  page: WebsitePublicPageMeta;
  sections: WebsitePublicSection[];
};

// ---------------------------------------------------------------------------
// Design System — CMS V4
// ---------------------------------------------------------------------------

/**
 * Response shape for GET /api/public/[tenant]/website/design-system
 * Access via: envelope.data.designSystem
 *
 * Returns the fully-resolved tenant design system tokens. The response is:
 *   - Always fully populated (DEFAULT_DESIGN_SYSTEM applied for any null fields).
 *   - Colour tokens primary/secondary are sourced from the existing branding system.
 *   - Cacheable (s-maxage=120, stale-while-revalidate=600).
 *   - Safe for public consumption (no admin metadata).
 *
 * The public website SHOULD:
 *   1. Fetch this endpoint once at build time / layout level.
 *   2. Apply sectionWidths tokens to the SectionShell width container.
 *   3. Apply typography tokens to global CSS or rendered headings/text.
 *   4. Apply button/card tokens to the corresponding components.
 *   5. Pass the resolved design system to SectionShell via the `designSystem` prop.
 *
 * See: lib/website/design-system-types.ts for the full ResolvedDesignSystem type.
 */
export type WebsiteDesignSystemData = {
  designSystem: import("@/lib/website/design-system-types").ResolvedDesignSystem;
};

// ---------------------------------------------------------------------------
// Cache revalidation — SCE-CANONICAL-PUBLISHING-01
// ---------------------------------------------------------------------------
//
// When SCE canonical public data changes, external tenant websites should
// invalidate tagged ISR caches. SCE sends signed POST requests to configured
// tenant endpoints after mutations.
//
// Tag format: sce:{tenantSlug}:{domain} — see lib/website/public-cache-tags.ts
// Full contract: docs/public-website-cache-revalidation.md
//
// Website follow-up: implement POST /api/revalidate with HMAC verification
// and revalidateTag() for each tag in the payload.
