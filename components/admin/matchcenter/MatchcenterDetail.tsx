import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Clock3,
  Cloud,
  ExternalLink,
  FileCheck2,
  Globe2,
  Info,
  MapPin,
  Radio,
  RefreshCw,
  ShieldCheck,
  Trophy,
  Users,
} from "lucide-react";
import type { MatchcenterMatchDetail } from "@/lib/matchcenter/types";
import {
  getMatchcenterLifecycleClassification,
  getMatchcenterLifecycleLabel,
  getMatchcenterLifecycleVariant,
  getMatchcenterResultLabel,
} from "@/lib/matchcenter/match-lifecycle";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { PageShell } from "@/components/ui/page/PageShell";
import { SectionCard } from "@/components/ui/page/SectionCard";
import { DetailPagePattern } from "@/components/ui/patterns/DetailPagePattern";
import MatchcenterDetailOperational from "@/components/admin/matchcenter/MatchcenterDetailOperational";
import MatchLifecycleCard from "@/components/admin/matchcenter/MatchLifecycleCard";
import type { FacilityResourceOption } from "@/lib/facilities/resource-options";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import PlanningWorkflowBadge from "@/components/admin/shared/PlanningWorkflowBadge";
import PlanningWorkflowActionsClient from "@/components/admin/shared/PlanningWorkflowActionsClient";
import { ClubLogo } from "@/components/admin/club-directory/ClubLogo";
import { resolveClubIdentityLogoUrl } from "@/lib/matchcenter/club-identity";
import { resolveMatchcenterCompactSideName } from "@/lib/matchcenter/team-display";
import { isMatchOperationallyActionable } from "@/lib/matchcenter/operational-state";

type MatchcenterDetailProps = {
  match: MatchcenterMatchDetail;
  locale?: string;
  timezone?: string;
  canManageMappings?: boolean;
  /**
   * ADMIN-DELETE-02A: effective PERMISSIONS.MATCHES_DELETE authority.
   * Deliberately independent of canManageMappings/events.manage.
   */
  canDelete?: boolean;
  /** MASTERDATA-CONSISTENCY-02 — canonical pitch/hall options for MatchcenterDetailOperational. */
  pitchOptions?: FacilityResourceOption[];
  /** MASTERDATA-CONSISTENCY-02 — canonical dressing-room options for MatchcenterDetailOperational. */
  dressingRoomOptions?: FacilityResourceOption[];
  /** PLANNING-RESOURCE-UX-01 — full facility groups for visual pickers. */
  pitchHallFacilityGroups?: FacilityGroup[];
  /** PLANNING-RESOURCE-UX-01 — full facility groups for visual dressing room pickers. */
  dressingRoomFacilityGroups?: FacilityGroup[];
  /**
   * ORG-ACCESS-03: planning workflow action visibility.
   * canSubmitPlanning: scoped user may submit this DRAFT record.
   * canValidatePlanning: coordinator may validate/reopen this record.
   * isProtectedSource: SFV/provider record — no scoped mutation controls shown.
   */
  canSubmitPlanning?: boolean;
  canValidatePlanning?: boolean;
  isProtectedSource?: boolean;
  /** Canonical tenant/club logo for own-team identity — MATCHCENTER-UX-03-C1. */
  tenantLogoUrl?: string | null;
};

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Entwurf",
  ARCHIVED: "Archiviert",
};

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  DRAFT: "outline",
  ARCHIVED: "outline",
};

function formatDateTime(
  value: Date | null,
  locale: string,
  timezone: string,
): string {
  if (!value) {
    return "Nicht hinterlegt";
  }

  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(value);
}

function formatTime(
  value: Date | null,
  locale: string,
  timezone: string,
): string {
  if (!value) {
    return "Nicht hinterlegt";
  }

  return new Intl.DateTimeFormat(locale, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: timezone,
  }).format(value);
}

function valueOrFallback(
  value: string | number | null | undefined,
): string {
  if (
    value === null ||
    value === undefined ||
    String(value).trim() === ""
  ) {
    return "Nicht hinterlegt";
  }

  return String(value);
}

function DetailRow({
  label,
  value,
  icon,
  testId,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
  testId?: string;
}) {
  return (
    <div
      className="grid gap-1 border-b border-[var(--border)] py-3 last:border-b-0 sm:grid-cols-[190px_minmax(0,1fr)] sm:gap-5"
      data-testid={testId}
    >
      <dt className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {icon}
        {label}
      </dt>

      <dd className="break-words text-sm font-medium text-[var(--foreground)]">
        {value}
      </dd>
    </div>
  );
}

export default function MatchcenterDetail({
  match,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  canManageMappings = false,
  canDelete = false,
  pitchOptions = [],
  dressingRoomOptions = [],
  pitchHallFacilityGroups,
  dressingRoomFacilityGroups,
  canSubmitPlanning = false,
  canValidatePlanning = false,
  isProtectedSource = false,
  tenantLogoUrl = null,
}: MatchcenterDetailProps) {
  const lifecycleClassification = getMatchcenterLifecycleClassification(match);
  const statusLabel =
    STATUS_LABELS[match.status] ??
    getMatchcenterLifecycleLabel(lifecycleClassification);

  const statusVariant =
    STATUS_VARIANTS[match.status] ??
    getMatchcenterLifecycleVariant(lifecycleClassification);

  const result = getMatchcenterResultLabel(match);
  const operationallyActionable = isMatchOperationallyActionable(match);

  const homeName = resolveMatchcenterCompactSideName(match.home);
  const awayName = resolveMatchcenterCompactSideName(match.away);
  const homeLogoUrl = resolveClubIdentityLogoUrl(match.home, tenantLogoUrl);
  const awayLogoUrl = resolveClubIdentityLogoUrl(match.away, tenantLogoUrl);

  const sourceLabel =
    match.source.provider ??
    match.source.externalSource ??
    match.source.eventSource;

  const normalizedHomeAway =
    match.homeAway?.trim().toUpperCase() ?? null;

  const homeAwayLabel =
    normalizedHomeAway === "HOME"
      ? "Heimspiel"
      : normalizedHomeAway === "AWAY"
        ? "Auswärtsspiel"
        : null;

  // ISO date string for the operational workspace (serializable to client)
  const matchDateIso = match.startAt.toISOString();
  // RESOURCE-AVAILABILITY-UX-01 — same start/end passed to the live
  // Frei/Belegt availability lookup in MatchcenterDetailOperational.
  const matchEndAtIso = match.endAt ? match.endAt.toISOString() : null;

  return (
    <PageShell fullWidth>
      <DetailPagePattern
        eyebrow="Spielbetrieb"
        title={match.title}
        description={
          match.competitionLabel ??
          "Matchdetails und operative Informationen"
        }
        headerBadge={
          <Badge
            variant={statusVariant}
            data-testid="matchcenter-detail-status"
          >
            {lifecycleClassification.lifecycle === "LIVE" ? (
              <Radio className="h-3.5 w-3.5" />
            ) : null}
            {statusLabel}
          </Badge>
        }
        breadcrumbs={[
          {
            label: "Matchcenter",
            href: "/dashboard/matchcenter",
          },
          {
            label: match.title,
          },
        ]}
        headerActions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/dashboard/matchcenter"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Zurück zum Matchcenter
            </Link>
          </div>
        }
        summary={
          <div className="space-y-4">
            <div
              className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-4"
              data-testid="matchcenter-detail-hero"
            >
              <div className="flex min-w-0 items-center justify-end gap-3">
                <div className="min-w-0 text-right">
                  <p
                    className={
                      match.home.isOwnTeam
                        ? "truncate text-lg font-bold text-[var(--foreground)]"
                        : "truncate text-lg font-semibold text-[var(--foreground)]"
                    }
                    data-testid="matchcenter-detail-home-team"
                  >
                    {homeName}
                  </p>
                </div>
                <ClubLogo
                  logoUrl={homeLogoUrl}
                  name={homeName}
                  size="lg"
                  bare
                  className="shrink-0"
                />
              </div>

              <div className="flex flex-col items-center justify-center px-2">
                {result ? (
                  <div
                    className="rounded-xl bg-[var(--foreground)] px-5 py-2.5 text-2xl font-bold tabular-nums text-white"
                    data-testid="matchcenter-detail-result"
                  >
                    {result}
                  </div>
                ) : (
                  <div className="text-lg font-semibold uppercase tracking-wide text-[var(--muted)]">
                    vs.
                  </div>
                )}

                {match.intermediateResultLabel ? (
                  <p
                    className="mt-1.5 text-xs text-[var(--muted)]"
                    data-testid="matchcenter-detail-intermediate-result"
                  >
                    HZ {match.intermediateResultLabel}
                  </p>
                ) : null}
              </div>

              <div className="flex min-w-0 items-center gap-3">
                <ClubLogo
                  logoUrl={awayLogoUrl}
                  name={awayName}
                  size="lg"
                  bare
                  className="shrink-0"
                />
                <div className="min-w-0">
                  <p
                    className={
                      match.away.isOwnTeam
                        ? "truncate text-lg font-bold text-[var(--foreground)]"
                        : "truncate text-lg font-semibold text-[var(--foreground)]"
                    }
                    data-testid="matchcenter-detail-away-team"
                  >
                    {awayName}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-[var(--text-2)]">
              {match.competitionLabel ? (
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-[var(--muted)]" />
                  {match.competitionLabel}
                </span>
              ) : null}
              <span
                className="inline-flex items-center gap-1.5"
                data-testid="matchcenter-detail-start"
              >
                <CalendarDays className="h-3.5 w-3.5 text-[var(--muted)]" />
                {formatDateTime(match.startAt, locale, timezone)}
              </span>
              {match.location ? (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-[var(--muted)]" />
                  {match.location}
                </span>
              ) : null}
              {homeAwayLabel ? (
                <span
                  className="text-xs font-semibold text-[var(--muted)]"
                  data-testid="matchcenter-detail-homeaway"
                >
                  {homeAwayLabel}
                </span>
              ) : null}
            </div>
          </div>
        }
        sidebar={
          <MatchLifecycleCard
            matchId={match.id}
            matchTitle={match.title}
            canDelete={canDelete}
          />
        }
      >
        <MatchcenterDetailOperational
          matchId={match.id}
          homeAway={match.homeAway}
          homeDisplayName={match.home.displayName}
          awayDisplayName={match.away.displayName}
          homeIsOwnTeam={match.home.isOwnTeam}
          awayIsOwnTeam={match.away.isOwnTeam}
          currentTeamId={match.teamId}
          currentPitchCode={match.operational.pitchCode}
          currentHomeDressingRoomCode={match.operational.homeDressingRoomCode}
          currentAwayDressingRoomCode={match.operational.awayDressingRoomCode}
          pitchHallFacilityGroups={pitchHallFacilityGroups}
          dressingRoomFacilityGroups={dressingRoomFacilityGroups}
          currentWebsiteVisible={match.visibility.websiteVisible}
          currentInfoboardVisible={match.visibility.infoboardVisible}
          matchDateIso={matchDateIso}
          matchEndAtIso={matchEndAtIso}
          canManage={canManageMappings}
          pitchOptions={pitchOptions}
          dressingRoomOptions={dressingRoomOptions}
          isOperationallyActionable={operationallyActionable}
        />

        {!isProtectedSource ? (
          <div className="flex items-center justify-between rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-[var(--muted)]">
                Planungsstatus
              </span>
              <PlanningWorkflowBadge stage={match.reviewStage} size="sm" />
            </div>
            <PlanningWorkflowActionsClient
              recordId={match.id}
              domain="match"
              planningStage={match.reviewStage}
              isCoordinator={canValidatePlanning}
              isProtectedSource={isProtectedSource}
            />
          </div>
        ) : null}

        <details
          className="rounded-lg border border-[var(--border)] bg-[var(--surface)] text-sm"
          data-testid="matchcenter-technical-details"
        >
          <summary className="cursor-pointer list-none px-4 py-3 font-medium text-[var(--foreground)] marker:content-none [&::-webkit-details-marker]:hidden">
            Technische Details
          </summary>

          <div className="space-y-6 border-t border-[var(--border)] px-4 py-4">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Quelle
              </h3>
              <dl>
                <DetailRow
                  label="Quelle"
                  value={valueOrFallback(sourceLabel)}
                  icon={<Cloud className="h-3.5 w-3.5" />}
                />
                <DetailRow
                  label="Event-Quelle"
                  value={valueOrFallback(match.source.eventSource)}
                />
                <DetailRow
                  label="Externe ID"
                  value={valueOrFallback(match.source.externalSourceId)}
                />
                <DetailRow
                  label="Provider Match-ID"
                  value={valueOrFallback(match.source.externalMatchId)}
                />
                <DetailRow
                  label="Saison-ID"
                  value={valueOrFallback(match.source.externalSeasonId)}
                />
                <DetailRow
                  label="Matchnummer"
                  value={valueOrFallback(match.source.matchNumber)}
                />
              </dl>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Provider
              </h3>
              <dl>
                <DetailRow
                  label="Liga"
                  value={valueOrFallback(match.providerLeagueName)}
                  icon={<Trophy className="h-3.5 w-3.5" />}
                />
                <DetailRow
                  label="Liga-ID"
                  value={valueOrFallback(match.providerLeagueId)}
                />
                <DetailRow
                  label="Division"
                  value={valueOrFallback(match.providerDivisionName)}
                />
                <DetailRow
                  label="Division-ID"
                  value={valueOrFallback(match.providerDivisionId)}
                />
                <DetailRow
                  label="Runde"
                  value={valueOrFallback(match.providerRoundNumber)}
                />
                <DetailRow
                  label="Organisation-ID"
                  value={valueOrFallback(match.providerOrganisationId)}
                />
                <DetailRow
                  label="Spielfeld-ID"
                  value={valueOrFallback(match.providerPlaygroundId)}
                />
                <DetailRow
                  label="Saison"
                  value={valueOrFallback(match.providerSeasonName)}
                />
                <DetailRow
                  label="Provider-Spielstätte"
                  value={valueOrFallback(match.providerVenueName)}
                />
                <DetailRow
                  label="Organisator"
                  value={valueOrFallback(match.organizerName)}
                  icon={<Users className="h-3.5 w-3.5" />}
                />
              </dl>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Synchronisierung
              </h3>
              <dl>
                <DetailRow
                  label="Event synchronisiert"
                  value={formatDateTime(
                    match.synchronization.eventLastSyncedAt,
                    locale,
                    timezone,
                  )}
                  icon={<RefreshCw className="h-3.5 w-3.5" />}
                />
                <DetailRow
                  label="Mapping synchronisiert"
                  value={formatDateTime(
                    match.synchronization.mappingLastSyncedAt,
                    locale,
                    timezone,
                  )}
                  icon={<ExternalLink className="h-3.5 w-3.5" />}
                />
                <DetailRow
                  label="Details synchronisiert"
                  value={formatDateTime(
                    match.synchronization.detailSyncedAt,
                    locale,
                    timezone,
                  )}
                  icon={<Cloud className="h-3.5 w-3.5" />}
                  testId="matchcenter-detail-synced"
                />
                <DetailRow
                  label="Provider-Status"
                  value={valueOrFallback(
                    match.synchronization.providerMatchStateName,
                  )}
                />
                <DetailRow
                  label="Provider-Statuscode"
                  value={valueOrFallback(
                    match.synchronization.providerMatchState,
                  )}
                />
              </dl>
            </div>

            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                Freigabe
              </h3>
              <dl>
                <DetailRow
                  label="Review-Status"
                  value={valueOrFallback(match.reviewStage)}
                  icon={<ShieldCheck className="h-3.5 w-3.5" />}
                />
                <DetailRow
                  label="Review angefordert"
                  value={formatDateTime(
                    match.reviewRequestedAt,
                    locale,
                    timezone,
                  )}
                />
                <DetailRow
                  label="Review abgeschlossen"
                  value={formatDateTime(
                    match.reviewedAt,
                    locale,
                    timezone,
                  )}
                  icon={<FileCheck2 className="h-3.5 w-3.5" />}
                />
                <DetailRow
                  label="Publiziert"
                  value={formatDateTime(
                    match.publishedAt,
                    locale,
                    timezone,
                  )}
                  icon={<Globe2 className="h-3.5 w-3.5" />}
                />
                <DetailRow
                  label="Review-Notiz"
                  value={valueOrFallback(match.reviewNotes)}
                />
                <DetailRow
                  label="Treffpunkt"
                  value={formatTime(
                    match.operational.meetingTime,
                    locale,
                    timezone,
                  )}
                  icon={<Clock3 className="h-3.5 w-3.5" />}
                  testId="matchcenter-detail-meeting-time"
                />
                <DetailRow
                  label="Bemerkungen"
                  value={valueOrFallback(match.operational.remarks)}
                  icon={<Info className="h-3.5 w-3.5" />}
                  testId="matchcenter-detail-remarks"
                />
              </dl>
            </div>
          </div>
        </details>
      </DetailPagePattern>
    </PageShell>
  );
}