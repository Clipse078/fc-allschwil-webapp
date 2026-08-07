import { Shield } from "lucide-react";

type MatchTeamLogoProps = {
  /** Accessible label — the team's display name. */
  label: string;
  emphasized?: boolean;
  /**
   * CLUB-DIRECTORY-02 — resolved Club Directory logo URL (ExternalTeam
   * override, falling back to the parent ExternalClub's crest — see
   * MatchcenterSide.externalLogoUrl / lib/club-directory/logo.ts). Renders
   * the crest when present; falls back to the neutral placeholder below
   * exactly as before when absent (own team side, no discovered/linked
   * opponent identity yet, or no logo set).
   */
  logoUrl?: string | null;
};

/**
 * Neutral team-identity placeholder for Matchcenter rows.
 *
 * MATCHCENTER-UX-01 Phase 0 investigation (SFV team imagery, §5/§17):
 *   `fetchTeamPicture()` (lib/integrations/sfv/client.ts) proves the SFV
 *   Club API exposes a per-team picture at GET /api/team/picture/{teamId}
 *   (base64 GIF, own teams and opponents alike). It is consumed today only
 *   by the not-yet-wired opponent-identity aggregation layer
 *   (lib/integrations/sfv/opponent-identity.ts /
 *   lib/integrations/sfv/batch-opponent-identity.ts) — both explicitly
 *   documented as "no data is persisted". There is:
 *     - no schema field on Team, TeamExternalMapping, Event, or
 *       MatchExternalMapping to cache a logo/picture reference;
 *     - no sync job that fetches/stores it;
 *     - no safe way to call it per-row at Matchcenter render time (it needs
 *       a fresh SFV-authenticated request per team, which is far too slow
 *       and fragile for a server-rendered admin list, and would introduce a
 *       hard runtime dependency on SFV availability for an internal page).
 *   Per the MATCHCENTER-UX-01 mandate, this stops at that architecture
 *   boundary rather than introducing a speculative schema/caching layer.
 *   This component renders a graceful, dimension-stable neutral placeholder
 *   instead. Follow-up: a dedicated logo-caching slice (e.g. a
 *   `TeamExternalMapping.pictureBlobUrl` field populated by a background
 *   job using the existing @vercel/blob dependency) would be required
 *   before real logos can be shown safely.
 */
export default function MatchTeamLogo({
  label,
  emphasized = false,
  logoUrl = null,
}: MatchTeamLogoProps) {
  const containerClassName = emphasized
    ? "inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border-strong)] bg-[var(--surface-2)] text-[var(--text-2)]"
    : "inline-flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)]";

  const trimmedLogoUrl = logoUrl?.trim() || null;

  if (trimmedLogoUrl !== null) {
    return (
      // External (Club Directory / provider) crest URLs are not part of
      // next/image's static asset pipeline; a plain <img> avoids configuring
      // remote patterns for arbitrary, tenant-managed provider hosts.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={trimmedLogoUrl}
        alt={label}
        title={label}
        className={`${containerClassName} object-cover`}
      />
    );
  }

  return (
    <span role="img" aria-label={label} title={label} className={containerClassName}>
      <Shield className="h-3.5 w-3.5" />
    </span>
  );
}
