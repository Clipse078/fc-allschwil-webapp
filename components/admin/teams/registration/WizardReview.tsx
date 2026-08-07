"use client";

import {
  Calendar,
  Building2,
  Star,
  Link2,
  Link2Off,
  Globe,
  Monitor,
  ChevronRight,
  Trophy,
  Dumbbell,
  MoreHorizontal,
  Smile,
} from "lucide-react";
import { cn } from "@/lib/cn";
import type {
  WizardFormData,
  EligibleSeason,
  EligibleOrgUnit,
  EligibleCompetition,
  ParticipationType,
} from "./types";
import {
  PARTICIPATION_TYPES,
  STEP_SEASON_ORG,
  STEP_TEAM,
  STEP_FEDERATION,
  STEP_PARTICIPATION,
  STEP_COMPETITION,
  STEP_PUBLICATION,
} from "./types";

type Props = {
  form: WizardFormData;
  seasons: EligibleSeason[];
  orgUnits: EligibleOrgUnit[];
  competitions: EligibleCompetition[];
  onGoToStep: (step: number) => void;
};

const PARTICIPATION_ICONS: Record<ParticipationType, React.ReactNode> = {
  COMPETITION: <Trophy className="h-3.5 w-3.5" />,
  TRAINING: <Dumbbell className="h-3.5 w-3.5" />,
  DEVELOPMENT: <Star className="h-3.5 w-3.5" />,
  RECREATIONAL: <Smile className="h-3.5 w-3.5" />,
  OTHER: <MoreHorizontal className="h-3.5 w-3.5" />,
};

/**
 * WizardReview — Final review screen before submission.
 *
 * Shows a summary of all entered values. Each section has an "Bearbeiten"
 * link that navigates back to the corresponding step.
 *
 * Updated in TEAM-CREATE-02 to include Participation and Competition sections.
 */
export default function WizardReview({
  form,
  seasons,
  orgUnits,
  competitions,
  onGoToStep,
}: Props) {
  const selectedSeason = seasons.find((s) => s.id === form.seasonId) ?? null;
  const selectedOrgUnits = form.orgUnitIds
    .map((id) => orgUnits.find((ou) => ou.id === id))
    .filter((ou): ou is EligibleOrgUnit => ou !== undefined);

  const hasMapping = form.federationExternalTeamId !== null;

  const participationType = PARTICIPATION_TYPES.find(
    (p) => p.value === form.participationType,
  );

  const selectedCompetition =
    form.competitionId
      ? (competitions.find((c) => c.id === form.competitionId) ?? null)
      : null;

  return (
    <div className="space-y-4">
      {/* Saison und Organisation */}
      <ReviewSection
        title="Saison und Organisation"
        onEdit={() => onGoToStep(STEP_SEASON_ORG)}
      >
        <ReviewRow
          icon={<Calendar className="h-3.5 w-3.5" />}
          label="Saison"
          value={selectedSeason?.name ?? "—"}
        />

        <ReviewRow
          icon={<Building2 className="h-3.5 w-3.5" />}
          label="Organisationseinheiten"
          value={
            selectedOrgUnits.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {selectedOrgUnits.map((ou, index) => (
                  <span
                    key={ou.id}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                      index === 0
                        ? "border-[var(--sce-primary)] bg-[color-mix(in_srgb,var(--sce-primary)_8%,transparent)] text-[var(--sce-primary)]"
                        : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]",
                    )}
                  >
                    {index === 0 && (
                      <Star className="h-2.5 w-2.5" aria-hidden="true" />
                    )}
                    {ou.name}
                  </span>
                ))}
              </div>
            ) : (
              "—"
            )
          }
        />
      </ReviewSection>

      {/* Team */}
      <ReviewSection title="Team" onEdit={() => onGoToStep(STEP_TEAM)}>
        <ReviewRow label="Langname" value={form.teamName || "—"} />
        {form.teamShortName && (
          <ReviewRow label="Kurzname" value={form.teamShortName} />
        )}
        {form.teamAlternativeName && (
          <ReviewRow label="Alternativname" value={form.teamAlternativeName} />
        )}
        <ReviewRow
          label="URL-Pfad"
          value={
            <span className="font-mono text-[var(--text-2)]">
              /{form.teamSlug}
            </span>
          }
        />
        {form.teamGenderGroup && (
          <ReviewRow label="Geschlechtergruppe" value={form.teamGenderGroup} />
        )}
        {form.teamAgeGroup && (
          <ReviewRow label="Altersklasse" value={form.teamAgeGroup} />
        )}
        {form.existingTeamId && (
          <ReviewRow
            label="Modus"
            value={
              <span className="text-[var(--sce-primary)]">
                Bestehendes Team für neue Saison
              </span>
            }
          />
        )}
      </ReviewSection>

      {/* Verband */}
      <ReviewSection title="Verband" onEdit={() => onGoToStep(STEP_FEDERATION)}>
        {hasMapping ? (
          <>
            <ReviewRow
              icon={<Link2 className="h-3.5 w-3.5" />}
              label="Verbandsteam"
              value={
                form.federationProviderTeamName ??
                `ID ${form.federationExternalTeamId}`
              }
            />
            {form.federationProviderLeagueName && (
              <ReviewRow
                label="Liga"
                value={form.federationProviderLeagueName}
              />
            )}
            <ReviewRow
              label="Anbieter"
              value={form.federationProvider ?? "—"}
            />
          </>
        ) : (
          <ReviewRow
            icon={<Link2Off className="h-3.5 w-3.5 text-[var(--text-3)]" />}
            label="Verbandsverbindung"
            value={
              <span className="text-[var(--text-2)]">
                Keine — wird manuell geführt
              </span>
            }
          />
        )}
      </ReviewSection>

      {/* Teilnahme */}
      <ReviewSection
        title="Teilnahme"
        onEdit={() => onGoToStep(STEP_PARTICIPATION)}
      >
        <ReviewRow
          icon={
            participationType
              ? PARTICIPATION_ICONS[participationType.value]
              : undefined
          }
          label="Teilnahmetyp"
          value={participationType?.label ?? form.participationType}
        />
        {participationType && (
          <ReviewRow
            label="Beschreibung"
            value={
              <span className="text-[var(--text-2)]">
                {participationType.description}
              </span>
            }
          />
        )}
      </ReviewSection>

      {/* Wettkampf — only shown for COMPETITION type */}
      {form.participationType === "COMPETITION" && (
        <ReviewSection
          title="Wettkampf"
          onEdit={() => onGoToStep(STEP_COMPETITION)}
        >
          {selectedCompetition ? (
            <>
              <ReviewRow
                icon={<Trophy className="h-3.5 w-3.5" />}
                label="Wettkampf"
                value={
                  selectedCompetition.shortName ??
                  selectedCompetition.officialName
                }
              />
              {selectedCompetition.groupName && (
                <ReviewRow
                  label="Gruppe"
                  value={selectedCompetition.groupName}
                />
              )}
              <ReviewRow
                label="Anbieter"
                value={
                  selectedCompetition.provider === "MANUAL"
                    ? "Manuell"
                    : selectedCompetition.provider
                }
              />
            </>
          ) : (
            <ReviewRow
              icon={<Trophy className="h-3.5 w-3.5 text-[var(--text-3)]" />}
              label="Wettkampf"
              value={
                <span className="text-amber-600">
                  Kein Wettkampf ausgewählt — wird später ergänzt
                </span>
              }
            />
          )}
        </ReviewSection>
      )}

      {/* Veröffentlichung */}
      <ReviewSection
        title="Veröffentlichung"
        onEdit={() => onGoToStep(STEP_PUBLICATION)}
      >
        <ReviewRow
          icon={<Globe className="h-3.5 w-3.5" />}
          label="Website"
          value={
            <span
              className={cn(
                "font-medium",
                form.websiteVisible
                  ? "text-emerald-700"
                  : "text-[var(--text-2)]",
              )}
            >
              {form.websiteVisible ? "Sichtbar" : "Versteckt"}
            </span>
          }
        />
        <ReviewRow
          icon={<Monitor className="h-3.5 w-3.5" />}
          label="Infoboard"
          value={
            <span
              className={cn(
                "font-medium",
                form.infoboardVisible
                  ? "text-emerald-700"
                  : "text-[var(--text-2)]",
              )}
            >
              {form.infoboardVisible ? "Sichtbar" : "Versteckt"}
            </span>
          }
        />
      </ReviewSection>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function ReviewSection({
  title,
  children,
  onEdit,
}: {
  title: string;
  children: React.ReactNode;
  onEdit: () => void;
}) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)]"
      aria-label={title}
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] bg-[var(--surface-2)] px-5 py-3">
        <h4 className="text-sm font-semibold text-[var(--foreground)]">
          {title}
        </h4>
        <button
          type="button"
          onClick={onEdit}
          className={cn(
            "inline-flex items-center gap-1 text-xs font-semibold text-[var(--sce-primary)]",
            "hover:underline underline-offset-4",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] rounded",
          )}
        >
          Bearbeiten
          <ChevronRight className="h-3 w-3" aria-hidden="true" />
        </button>
      </div>
      <div className="divide-y divide-[var(--border)] px-5">{children}</div>
    </section>
  );
}

function ReviewRow({
  icon,
  label,
  value,
}: {
  icon?: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-3 py-3">
      {icon && (
        <span
          className="mt-0.5 shrink-0 text-[var(--text-3)]"
          aria-hidden="true"
        >
          {icon}
        </span>
      )}
      <div className="min-w-0 flex-1 sm:grid sm:grid-cols-[180px_1fr] sm:gap-4">
        <span className="text-xs font-medium text-[var(--text-3)] sm:pt-0.5">
          {label}
        </span>
        <span className="mt-0.5 text-sm text-[var(--foreground)] sm:mt-0">
          {value}
        </span>
      </div>
    </div>
  );
}
