import Link from "next/link";
import {
  ArrowLeft,
  CalendarDays,
  Check,
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
import { Badge, type BadgeVariant } from "@/components/ui/Badge";
import { PageShell } from "@/components/ui/page/PageShell";
import { SectionCard } from "@/components/ui/page/SectionCard";
import { DetailPagePattern } from "@/components/ui/patterns/DetailPagePattern";
import MatchTeamMappingDialog from "@/components/admin/matchcenter/MatchTeamMappingDialog";

type MatchcenterDetailProps = {
  match: MatchcenterMatchDetail;
  locale?: string;
  timezone?: string;
  canManageMappings?: boolean;
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

function getResult(match: MatchcenterMatchDetail): string | null {
  if (
    match.scoreHome !== null &&
    match.scoreAway !== null
  ) {
    return `${match.scoreHome}:${match.scoreAway}`;
  }

  return match.resultLabel;
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
}: MatchcenterDetailProps) {
  const statusLabel =
    STATUS_LABELS[match.status] ?? match.status;

  const statusVariant =
    STATUS_VARIANTS[match.status] ?? "default";

  const result = getResult(match);

  const sourceLabel =
    match.source.provider ??
    match.source.externalSource ??
    match.source.eventSource;

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
            {match.status === "LIVE" ? (
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
            <SectionCard
              title="Sichtbarkeit"
              description="Aktive Ausgabekanäle"
            >
              <div className="space-y-2">
                <BooleanStatus
                  active={match.visibility.websiteVisible}
                  label="Website"
                />
                <BooleanStatus
                  active={match.visibility.infoboardVisible}
                  label="Infoboard"
                />
                <BooleanStatus
                  active={match.visibility.homepageVisible}
                  label="Homepage"
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
        </SectionCard>
      </DetailPagePattern>
    </PageShell>
  );
}