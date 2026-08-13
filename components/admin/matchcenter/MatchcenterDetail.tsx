import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  Cloud,
  ExternalLink,
  FileCheck2,
  Flag,
  Globe2,
  Home,
  Info,
  MapPin,
  Radio,
  RefreshCw,
  ShieldCheck,
  Shirt,
  Trophy,
  Users,
  Volleyball,
  X,
} from "lucide-react";
import type { MatchcenterMatchDetail } from "@/lib/matchcenter/types";
import { getMatchcenterResultLabel } from "@/lib/matchcenter/match-lifecycle";
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { PageShell } from "@/components/ui/page/PageShell";
import { SectionCard } from "@/components/ui/page/SectionCard";
import { DetailPagePattern } from "@/components/ui/patterns/DetailPagePattern";
import MatchTeamMappingDialog from "@/components/admin/matchcenter/MatchTeamMappingDialog";
import MatchcenterDetailOperational from "@/components/admin/matchcenter/MatchcenterDetailOperational";
import MatchLifecycleCard from "@/components/admin/matchcenter/MatchLifecycleCard";
import type { FacilityResourceOption } from "@/lib/facilities/resource-options";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import PlanningWorkflowBadge from "@/components/admin/shared/PlanningWorkflowBadge";
import PlanningWorkflowActionsClient from "@/components/admin/shared/PlanningWorkflowActionsClient";

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
};

const STATUS_LABELS: Record<string, string> = {
  SCHEDULED: "Geplant",
  LIVE: "Live",
  COMPLETED: "Abgeschlossen",
  POSTPONED: "Verschoben",
  CANCELED: "Abgesagt",
  CANCELLED: "Abgesagt",
  DRAFT: "Entwurf",
  ARCHIVED: "Archiviert",
};

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  SCHEDULED: "info",
  LIVE: "success",
  COMPLETED: "default",
  POSTPONED: "warning",
  CANCELED: "danger",
  CANCELLED: "danger",
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

function BooleanStatus({
  active,
  label,
}: {
  active: boolean;
  label: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2.5">
      <span className="text-sm text-[var(--foreground)]">
        {label}
      </span>

      <Badge
        variant={active ? "success" : "default"}
        size="sm"
      >
        {active ? (
          <Check className="h-3 w-3" />
        ) : (
          <X className="h-3 w-3" />
        )}
        {active ? "Sichtbar" : "Nicht sichtbar"}
      </Badge>
    </div>
  );
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
}: MatchcenterDetailProps) {
  const statusLabel =
    STATUS_LABELS[match.status] ?? match.status;

  const statusVariant =
    STATUS_VARIANTS[match.status] ?? "default";

  const result = getMatchcenterResultLabel(match);

  const unresolvedSides = [
    match.home,
    match.away,
  ].filter(
    (side) => side.resolution === "UNRESOLVED",
  );

  const hasUnresolvedProviderMapping =
    match.source.provider !== null &&
    match.source.externalSeasonId !== null &&
    unresolvedSides.some(
      (side) => side.providerTeamId !== null,
    );

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

  const homeAwayVariant: BadgeVariant =
    normalizedHomeAway === "HOME"
      ? "success"
      : normalizedHomeAway === "AWAY"
        ? "default"
        : "outline";

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
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={statusVariant}
              data-testid="matchcenter-detail-status"
            >
              {match.status === "LIVE" ? (
                <Radio className="h-3.5 w-3.5" />
              ) : null}
              {statusLabel}
            </Badge>

            {homeAwayLabel ? (
              <Badge
                variant={homeAwayVariant}
                data-testid="matchcenter-detail-homeaway"
              >
                {normalizedHomeAway === "HOME" ? (
                  <Home className="h-3.5 w-3.5" />
                ) : (
                  <Flag className="h-3.5 w-3.5" />
                )}
                {homeAwayLabel}
              </Badge>
            ) : null}
          </div>
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
            {canManageMappings &&
            match.source.provider &&
            match.source.externalSeasonId !== null &&
            (
              match.home.resolution === "UNRESOLVED" ||
              match.away.resolution === "UNRESOLVED"
            ) ? (
              <MatchTeamMappingDialog
                provider={match.source.provider}
                externalSeasonId={
                  match.source.externalSeasonId
                }
                sides={[
                  match.home,
                  match.away,
                ]}
              />
            ) : null}

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
          <SectionCard
            accent
            bodyClassName="px-5 py-6"
          >
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:items-center">
              <div className="min-w-0 text-center lg:text-left">
                <div className="mb-2 flex items-center justify-center gap-2 lg:justify-start">
                  <Home className="h-4 w-4 text-[var(--muted)]" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Heimteam
                  </span>
                </div>

                <p
                  className={
                    match.home.isOwnTeam
                      ? "text-xl font-bold text-[var(--foreground)]"
                      : "text-xl font-semibold text-[var(--foreground)]"
                  }
                  data-testid="matchcenter-detail-home-team"
                >
                  {match.home.displayName}
                </p>

                <div className="mt-2 flex justify-center lg:justify-start">
                  <Badge
                    variant={
                      match.home.resolution === "RESOLVED"
                        ? "success"
                        : "warning"
                    }
                    size="sm"
                  >
                    {match.home.resolution === "RESOLVED"
                      ? "Zugeordnet"
                      : "Nicht zugeordnet"}
                  </Badge>
                </div>
              </div>

              <div className="flex flex-col items-center justify-center">
                {result ? (
                  <div
                    className="rounded-2xl bg-[var(--foreground)] px-6 py-3 text-3xl font-bold tabular-nums text-white shadow-sm"
                    data-testid="matchcenter-detail-result"
                  >
                    {result}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface-2)] px-6 py-3 text-xl font-bold uppercase tracking-wide text-[var(--muted)]">
                    vs.
                  </div>
                )}

                {match.intermediateResultLabel ? (
                  <p
                    className="mt-2 text-xs font-medium text-[var(--muted)]"
                    data-testid="matchcenter-detail-intermediate-result"
                  >
                    Halbzeit: {match.intermediateResultLabel}
                  </p>
                ) : null}
              </div>

              <div className="min-w-0 text-center lg:text-right">
                <div className="mb-2 flex items-center justify-center gap-2 lg:justify-end">
                  <Flag className="h-4 w-4 text-[var(--muted)]" />
                  <span className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                    Auswärtsteam
                  </span>
                </div>

                <p
                  className={
                    match.away.isOwnTeam
                      ? "text-xl font-bold text-[var(--foreground)]"
                      : "text-xl font-semibold text-[var(--foreground)]"
                  }
                  data-testid="matchcenter-detail-away-team"
                >
                  {match.away.displayName}
                </p>

                <div className="mt-2 flex justify-center lg:justify-end">
                  <Badge
                    variant={
                      match.away.resolution === "RESOLVED"
                        ? "success"
                        : "warning"
                    }
                    size="sm"
                  >
                    {match.away.resolution === "RESOLVED"
                      ? "Zugeordnet"
                      : "Nicht zugeordnet"}
                  </Badge>
                </div>
              </div>
            </div>
          </SectionCard>
        }
        sidebar={
          <>
            <MatchLifecycleCard
              matchId={match.id}
              matchTitle={match.title}
              canDelete={canDelete}
            />

            <SectionCard
              title="Sichtbarkeit"
              description="Aktive Ausgabekanäle"
            >
              <div className="space-y-2">
                <BooleanStatus
                  active={match.visibility.websiteVisible}
                  label="Website (inkl. Homepage)"
                />
                <BooleanStatus
                  active={match.visibility.infoboardVisible}
                  label="Infoboard"
                />
                <BooleanStatus
                  active={match.visibility.wochenplanVisible}
                  label="Wochenplan"
                />
                <BooleanStatus
                  active={match.visibility.trainingsplanVisible}
                  label="Trainingsplan"
                />
                <BooleanStatus
                  active={match.visibility.teamPageVisible}
                  label="Teamseite"
                />
              </div>
            </SectionCard>

            <SectionCard
              title="Quelle"
              description="Herkunft und Provider"
            >
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
                  label="Externe Quelle"
                  value={valueOrFallback(match.source.externalSource)}
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
            </SectionCard>
          </>
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
        />

        <SectionCard
          title="Team-Zuordnung"
          description="Status der Provider-Teams im Matchcenter"
          bodyClassName="px-5 py-5"
        >
          {unresolvedSides.length === 0 ? (
            <div
              className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
              data-testid="matchcenter-mapping-status-resolved"
            >
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />

              <div>
                <p className="text-sm font-semibold text-emerald-900">
                  Teams vollständig zugeordnet
                </p>
                <p className="mt-1 text-sm leading-relaxed text-emerald-800">
                  Heim- und Auswärtsteam sind mit internen
                  Matchcenter-Teams verknüpft.
                </p>
              </div>
            </div>
          ) : (
            <div
              className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-4"
              data-testid="matchcenter-mapping-status-unresolved"
            >
              <div className="flex items-start gap-3">
                <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-amber-950">
                    {unresolvedSides.length === 1
                      ? "Eine Team-Zuordnung ist offen"
                      : `${unresolvedSides.length} Team-Zuordnungen sind offen`}
                  </p>

                  <p className="mt-1 text-sm leading-relaxed text-amber-900">
                    {unresolvedSides
                      .map((side) => side.displayName)
                      .join(" und ")}{" "}
                    {unresolvedSides.length === 1
                      ? "ist noch keinem internen Team zugeordnet."
                      : "sind noch keinem internen Team zugeordnet."}
                  </p>

                  {hasUnresolvedProviderMapping ? (
                    <>
                      <p className="mt-2 text-sm leading-relaxed text-amber-900">
                        Nach dem Speichern einer Zuordnung muss
                        der Spielplan synchronisiert werden.
                        Erst danach werden betroffene Matches
                        mit der neuen Zuordnung aktualisiert.
                      </p>

                      <Link
                        href="/dashboard/admin/integrations/sfv"
                        className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3.5 py-2 text-sm font-semibold text-amber-950 transition hover:bg-amber-100"
                      >
                        <RefreshCw className="h-3.5 w-3.5" />
                        Zur Spielplansynchronisation
                      </Link>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Spieldaten"
          description="Zeitpunkt, Wettbewerb und Spielstätte"
        >
          <dl>
            <DetailRow
              label="Anspielzeit"
              value={formatDateTime(
                match.startAt,
                locale,
                timezone,
              )}
              icon={<CalendarDays className="h-3.5 w-3.5" />}
              testId="matchcenter-detail-start"
            />
            <DetailRow
              label="Ende"
              value={formatDateTime(
                match.endAt,
                locale,
                timezone,
              )}
              icon={<Clock3 className="h-3.5 w-3.5" />}
            />
            <DetailRow
              label="Wettbewerb"
              value={valueOrFallback(match.competitionLabel)}
              icon={<Trophy className="h-3.5 w-3.5" />}
            />
            <DetailRow
              label="Spielort"
              value={valueOrFallback(match.location)}
              icon={<MapPin className="h-3.5 w-3.5" />}
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
            <DetailRow
              label="Heim/Auswärts"
              value={valueOrFallback(match.homeAway)}
            />
          </dl>
        </SectionCard>

        <SectionCard
          title="Operative Informationen"
          description="Club-verwaltete Angaben für den Spielbetrieb"
        >
          <dl>
            <DetailRow
              label="Feld"
              value={valueOrFallback(match.operational.pitchCode)}
              icon={<Volleyball className="h-3.5 w-3.5" />}
              testId="matchcenter-detail-pitch"
            />
            <DetailRow
              label="Garderobe Heim"
              value={valueOrFallback(
                match.operational.homeDressingRoomCode,
              )}
              icon={<Shirt className="h-3.5 w-3.5" />}
            />
            <DetailRow
              label="Garderobe Gast"
              value={valueOrFallback(
                match.operational.awayDressingRoomCode,
              )}
              icon={<Shirt className="h-3.5 w-3.5" />}
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
        </SectionCard>

        <SectionCard
          title="Provider-Details"
          description="Erweiterte Wettbewerbs- und Zuordnungsdaten"
        >
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
              value={valueOrFallback(
                match.providerOrganisationId,
              )}
            />
            <DetailRow
              label="Spielfeld-ID"
              value={valueOrFallback(match.providerPlaygroundId)}
            />
            <DetailRow
              label="Saison"
              value={valueOrFallback(match.providerSeasonName)}
            />
          </dl>
        </SectionCard>

        <SectionCard
          title="Synchronisierung"
          description="Letzte Aktualisierungen der Matchdaten"
        >
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
        </SectionCard>

        <SectionCard
          title="Freigabe"
          description="Review- und Publikationsinformationen"
        >
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
          </dl>
          {/* ORG-ACCESS-03: planning workflow actions for MANUAL matches */}
          {!isProtectedSource && (
            <div className="mt-4 flex items-center justify-between border-t border-[var(--border)] pt-4">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-[var(--muted)]">Planungsstatus:</span>
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
          )}
        </SectionCard>
      </DetailPagePattern>
    </PageShell>
  );
}