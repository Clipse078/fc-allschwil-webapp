"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowLeft, ArrowRight, ClipboardCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { Button, ValidationSummary } from "@/components/ui";
import { PageBreadcrumbs, PageHeader } from "@/components/ui/page";
import { useToast } from "@/hooks/use-toast";

import WizardStepIndicator from "./WizardStepIndicator";
import StepSeasonAndOrgUnit from "./StepSeasonAndOrgUnit";
import StepTeamIdentity from "./StepTeamIdentity";
import StepFederation from "./StepFederation";
import StepParticipation from "./StepParticipation";
import StepCompetition from "./StepCompetition";
import StepPublication from "./StepPublication";
import WizardReview from "./WizardReview";

import {
  INITIAL_FORM_DATA,
  WIZARD_STEP_DEFS,
  STEP_SEASON_ORG,
  STEP_TEAM,
  STEP_FEDERATION,
  STEP_PARTICIPATION,
  STEP_COMPETITION,
  STEP_PUBLICATION,
  type EligibleOrgUnit,
  type EligibleSeason,
  type EligibleCompetition,
  type ExistingTeam,
  type UnmappedFederationTeam,
  type WizardFormData,
  type ParticipationType,
} from "./types";
import { normalizeTeamSlug } from "@/lib/teams/team-season-rules";

// ---------------------------------------------------------------------------
// Types for server data
// ---------------------------------------------------------------------------

type EligibleData = {
  seasons: EligibleSeason[];
  orgUnits: EligibleOrgUnit[];
  existingTeams: ExistingTeam[];
  unmappedFederationTeams: UnmappedFederationTeam[];
  eligibleCompetitions: EligibleCompetition[];
};

// ---------------------------------------------------------------------------
// Validation per step
// ---------------------------------------------------------------------------

function validateStep(
  step: number,
  form: WizardFormData,
  competitions: EligibleCompetition[],
): Partial<Record<string, string>> {
  const errors: Partial<Record<string, string>> = {};

  if (step === STEP_SEASON_ORG) {
    if (!form.seasonId) errors.seasonId = "Wähle eine Saison aus.";
    if (form.orgUnitIds.length === 0)
      errors.orgUnitIds = "Wähle mindestens eine Organisationseinheit aus.";
  }

  if (step === STEP_TEAM) {
    if (!form.teamName.trim())
      errors.teamName = "Teamname ist erforderlich.";
    if (!form.teamSlug.trim())
      errors.teamSlug = "URL-Pfad ist erforderlich.";
  }

  if (step === STEP_COMPETITION) {
    // Competition is required for COMPETITION type when competitions exist
    if (
      form.participationType === "COMPETITION" &&
      !form.competitionId &&
      competitions.length > 0
    ) {
      errors.competitionId =
        "Bitte wähle einen Wettkampf für das Wettkampfteam aus.";
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Wizard
// ---------------------------------------------------------------------------

export default function TeamRegistrationWizard() {
  const router = useRouter();
  const { toast } = useToast();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [form, setForm] = useState<WizardFormData>(INITIAL_FORM_DATA);
  const [currentStep, setCurrentStep] = useState<number>(0);
  const [showReview, setShowReview] = useState(false);

  // ── Validation state ───────────────────────────────────────────────────────
  const [stepErrors, setStepErrors] = useState<Partial<Record<string, string>>>({});

  // ── Server data ────────────────────────────────────────────────────────────
  const [eligibleData, setEligibleData] = useState<EligibleData | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // ── Submission state ───────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ── Unsaved changes warning ────────────────────────────────────────────────
  const [hasEdited, setHasEdited] = useState(false);
  const [showDiscardDialog, setShowDiscardDialog] = useState(false);

  // ── Focus management ──────────────────────────────────────────────────────
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  // ── Effective (visible) steps — Competition step is conditional ───────────
  const effectiveSteps = useMemo(
    () =>
      WIZARD_STEP_DEFS.filter((s) => {
        if (s.index === STEP_COMPETITION) {
          return form.participationType === "COMPETITION";
        }
        return true;
      }),
    [form.participationType],
  );

  // Resolve next/prev step indices considering conditional steps
  const nextStepIndex = useCallback(
    (current: number): number | null => {
      const indices = effectiveSteps.map((s) => s.index);
      const pos = indices.indexOf(current);
      return pos >= 0 && pos < indices.length - 1 ? indices[pos + 1] : null;
    },
    [effectiveSteps],
  );

  const prevStepIndex = useCallback(
    (current: number): number | null => {
      const indices = effectiveSteps.map((s) => s.index);
      const pos = indices.indexOf(current);
      return pos > 0 ? indices[pos - 1] : null;
    },
    [effectiveSteps],
  );

  // ── Load eligible data on mount ────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;

    async function loadData() {
      setDataLoading(true);
      setDataError(null);

      try {
        const res = await fetch("/api/teams/register-eligible-data", {
          cache: "no-store",
        });
        const json = await res.json().catch(() => null);

        if (!res.ok || !json) {
          throw new Error(
            json?.error ?? "Daten konnten nicht geladen werden.",
          );
        }

        if (cancelled) return;

        const data = json as EligibleData;
        setEligibleData(data);

        // Preselect active or first season
        if (!form.seasonId) {
          const preferred =
            data.seasons.find((s) => s.lifecycleStatus === "ONGOING") ??
            data.seasons[0] ??
            null;
          if (preferred) {
            setForm((prev) => ({ ...prev, seasonId: preferred.id }));
          }
        }
      } catch (err) {
        if (!cancelled) {
          setDataError(
            err instanceof Error
              ? err.message
              : "Unbekannter Fehler beim Laden.",
          );
        }
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    }

    loadData();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Focus on step change ────────────────────────────────────────────────────
  useEffect(() => {
    stepHeadingRef.current?.focus();
  }, [currentStep, showReview]);

  // ── Unsaved changes browser warning ────────────────────────────────────────
  useEffect(() => {
    if (!hasEdited) return;

    function handleBeforeUnload(e: BeforeUnloadEvent) {
      e.preventDefault();
      e.returnValue = "";
    }

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasEdited]);

  // ── Field change helper ─────────────────────────────────────────────────────
  const handleFieldChange = useCallback(
    <K extends keyof WizardFormData>(key: K, value: WizardFormData[K]) => {
      setForm((prev) => ({ ...prev, [key]: value }));
      setHasEdited(true);
      setStepErrors({});
    },
    [],
  );

  // ── OrgUnit toggle ─────────────────────────────────────────────────────────
  function handleOrgUnitToggle(orgUnitId: string) {
    setForm((prev) => {
      const ids = prev.orgUnitIds;
      if (ids.includes(orgUnitId)) {
        return { ...prev, orgUnitIds: ids.filter((id) => id !== orgUnitId) };
      } else {
        return { ...prev, orgUnitIds: [...ids, orgUnitId] };
      }
    });
    setHasEdited(true);
    setStepErrors({});
  }

  function handlePrimaryChange(orgUnitId: string) {
    setForm((prev) => {
      const ids = prev.orgUnitIds.filter((id) => id !== orgUnitId);
      return { ...prev, orgUnitIds: [orgUnitId, ...ids] };
    });
    setHasEdited(true);
  }

  // ── Federation team selection ──────────────────────────────────────────────
  function handleSelectFederationTeam(team: UnmappedFederationTeam | null) {
    if (team === null) {
      setForm((prev) => ({
        ...prev,
        federationProvider: null,
        federationExternalTeamId: null,
        federationExternalSeasonId: null,
        federationProviderTeamName: null,
        federationProviderLeagueName: null,
      }));
    } else {
      setForm((prev) => ({
        ...prev,
        federationProvider: team.provider,
        federationExternalTeamId: team.externalTeamId,
        federationExternalSeasonId: team.externalSeasonId,
        federationProviderTeamName: team.providerTeamName,
        federationProviderLeagueName: team.providerLeagueName,
      }));
    }
    setHasEdited(true);
  }

  // ── Participation type change — clear competition when not COMPETITION ─────
  function handleParticipationTypeChange(value: ParticipationType) {
    setForm((prev) => ({
      ...prev,
      participationType: value,
      // Clear competition selection when switching away from COMPETITION type
      competitionId: value === "COMPETITION" ? prev.competitionId : null,
    }));
    setHasEdited(true);
    setStepErrors({});
  }

  // ── Navigation ─────────────────────────────────────────────────────────────
  function handleNext() {
    const competitions = eligibleData?.eligibleCompetitions ?? [];
    const errors = validateStep(currentStep, form, competitions);
    if (Object.keys(errors).length > 0) {
      setStepErrors(errors);
      return;
    }

    setStepErrors({});

    const next = nextStepIndex(currentStep);
    if (next !== null) {
      setCurrentStep(next);
    } else {
      // Last visible step — move to review
      setShowReview(true);
    }
  }

  function handleBack() {
    if (showReview) {
      setShowReview(false);
      return;
    }
    const prev = prevStepIndex(currentStep);
    if (prev !== null) {
      setCurrentStep(prev);
    }
  }

  function handleGoToStep(step: number) {
    setShowReview(false);
    setCurrentStep(step);
  }

  // ── Cancel with unsaved-changes guard ─────────────────────────────────────
  function handleCancel() {
    if (hasEdited) {
      setShowDiscardDialog(true);
    } else {
      router.push("/dashboard/teams");
    }
  }

  function handleConfirmDiscard() {
    setShowDiscardDialog(false);
    router.push("/dashboard/teams");
  }

  // ── Final submission ───────────────────────────────────────────────────────
  async function handleSubmit() {
    if (submitting) return;

    setSubmitting(true);
    setSubmitError(null);

    try {
      const payload = {
        seasonId: form.seasonId,
        orgUnitIds: form.orgUnitIds,
        existingTeamId: form.existingTeamId ?? undefined,
        team: {
          name: form.teamName,
          slug: form.teamSlug || normalizeTeamSlug(form.teamName),
          shortName: form.teamShortName || undefined,
          genderGroup: form.teamGenderGroup || undefined,
          ageGroup: form.teamAgeGroup || undefined,
          sortOrder: form.teamSortOrder,
        },
        participationType: form.participationType,
        competitionId: form.competitionId ?? undefined,
        federationMapping:
          form.federationProvider &&
          form.federationExternalTeamId !== null &&
          form.federationExternalSeasonId !== null
            ? {
                provider: form.federationProvider,
                externalTeamId: form.federationExternalTeamId,
                externalSeasonId: form.federationExternalSeasonId,
                providerTeamName: form.federationProviderTeamName,
                providerLeagueName: form.federationProviderLeagueName,
              }
            : undefined,
        websiteVisible: form.websiteVisible,
        infoboardVisible: form.infoboardVisible,
      };

      const res = await fetch("/api/teams/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(
          data?.error ?? "Team konnte nicht registriert werden.",
        );
      }

      toast.success("Team wurde registriert.");
      router.push("/dashboard/teams/" + data.teamId);
      router.refresh();
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Ein unbekannter Fehler ist aufgetreten.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  // ── Step meta ──────────────────────────────────────────────────────────────
  const visibleStepPosition = effectiveSteps.findIndex(
    (s) => s.index === currentStep,
  );
  const isFirstStep = currentStep === STEP_SEASON_ORG;
  const isLastVisibleStep =
    visibleStepPosition === effectiveSteps.length - 1;

  const stepDescriptions: Record<number, string> = {
    [STEP_SEASON_ORG]:
      "Lege fest, für welche Saison das Team registriert wird und welchen Organisationseinheiten es zugeordnet ist.",
    [STEP_TEAM]:
      "Erfasse die Identität des Teams. Weitere Angaben wie Spieler, Trainer und Trainings werden nach der Registrierung ergänzt.",
    [STEP_FEDERATION]:
      "Verbinde das Team optional mit einem Team aus dem angebundenen Verband. Die Verbindung kann auch später eingerichtet werden.",
    [STEP_PARTICIPATION]:
      "Lege fest, wie das Team in dieser Saison teilnimmt — als Wettkampfteam, Trainingsgruppe oder auf andere Weise.",
    [STEP_COMPETITION]:
      "Weise dem Wettkampfteam einen Wettkampf zu. Die Auswahl kann nach der Registrierung geändert werden.",
    [STEP_PUBLICATION]:
      "Lege fest, wo das Team nach der Registrierung sichtbar sein soll.",
  };

  const currentStepDef = WIZARD_STEP_DEFS[currentStep];

  // ── Data loading / error guard ────────────────────────────────────────────
  if (dataError) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <AlertTriangle
          className="mx-auto mb-4 h-10 w-10 text-[var(--sce-danger)]"
          aria-hidden="true"
        />
        <h2 className="text-base font-semibold text-[var(--foreground)]">
          Fehler beim Laden
        </h2>
        <p className="mt-2 text-sm text-[var(--text-2)]">{dataError}</p>
        <Button
          variant="secondary"
          className="mt-6"
          onClick={() => window.location.reload()}
        >
          Erneut versuchen
        </Button>
      </div>
    );
  }

  const competitions = eligibleData?.eligibleCompetitions ?? [];

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col">
      {/* Breadcrumbs */}
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Teams", href: "/dashboard/teams" },
          { label: "Team registrieren" },
        ]}
      />

      {/* Page header */}
      <PageHeader
        eyebrow="Teams"
        title={showReview ? "Team prüfen" : "Team registrieren"}
        description={
          showReview
            ? "Prüfe deine Angaben vor der Registrierung."
            : stepDescriptions[currentStep]
        }
      />

      {/* Step indicator */}
      <div className="mt-4 mb-8">
        <WizardStepIndicator
          steps={effectiveSteps.map((s) => ({ ...s }))}
          currentStep={
            showReview ? effectiveSteps.length : visibleStepPosition
          }
          completedUpTo={
            showReview ? effectiveSteps.length - 1 : visibleStepPosition - 1
          }
        />
      </div>

      {/* Main content */}
      <div className="mx-auto w-full max-w-2xl">
        {/* Step heading (for screen readers and focus) */}
        <h2
          ref={stepHeadingRef}
          tabIndex={-1}
          className={cn(
            "mb-6 text-base font-semibold text-[var(--foreground)] outline-none",
            showReview && "sr-only",
          )}
          aria-live="polite"
        >
          {showReview ? "Zusammenfassung" : currentStepDef?.label}
        </h2>

        {/* Step content */}
        {showReview ? (
          <WizardReview
            form={form}
            seasons={eligibleData?.seasons ?? []}
            orgUnits={eligibleData?.orgUnits ?? []}
            competitions={competitions}
            onGoToStep={handleGoToStep}
          />
        ) : currentStep === STEP_SEASON_ORG ? (
          <StepSeasonAndOrgUnit
            seasons={eligibleData?.seasons ?? []}
            orgUnits={eligibleData?.orgUnits ?? []}
            selectedSeasonId={form.seasonId}
            selectedOrgUnitIds={form.orgUnitIds}
            onSeasonChange={(id) => handleFieldChange("seasonId", id)}
            onOrgUnitToggle={handleOrgUnitToggle}
            onPrimaryChange={handlePrimaryChange}
            loading={dataLoading}
          />
        ) : currentStep === STEP_TEAM ? (
          <StepTeamIdentity
            form={form}
            existingTeams={eligibleData?.existingTeams ?? []}
            onFieldChange={handleFieldChange}
            validationErrors={stepErrors}
          />
        ) : currentStep === STEP_FEDERATION ? (
          <StepFederation
            unmappedFederationTeams={
              eligibleData?.unmappedFederationTeams ?? []
            }
            form={form}
            onSelectFederationTeam={handleSelectFederationTeam}
            loading={dataLoading}
            providerUnavailable={!dataLoading && !!dataError}
          />
        ) : currentStep === STEP_PARTICIPATION ? (
          <StepParticipation
            participationType={form.participationType}
            onParticipationTypeChange={handleParticipationTypeChange}
          />
        ) : currentStep === STEP_COMPETITION ? (
          <StepCompetition
            competitions={competitions}
            selectedCompetitionId={form.competitionId}
            onSelectCompetition={(id) => handleFieldChange("competitionId", id)}
            loading={dataLoading}
          />
        ) : currentStep === STEP_PUBLICATION ? (
          <StepPublication
            websiteVisible={form.websiteVisible}
            infoboardVisible={form.infoboardVisible}
            onWebsiteVisibleChange={(v) =>
              handleFieldChange("websiteVisible", v)
            }
            onInfoboardVisibleChange={(v) =>
              handleFieldChange("infoboardVisible", v)
            }
          />
        ) : null}

        {/* Step-level validation errors */}
        {Object.keys(stepErrors).length > 0 && (
          <div className="mt-4" aria-live="assertive">
            <ValidationSummary
              errors={Object.values(stepErrors).filter(Boolean) as string[]}
            />
          </div>
        )}

        {/* Submit error */}
        {submitError && (
          <div className="mt-4" aria-live="assertive">
            <ValidationSummary errors={[submitError]} />
          </div>
        )}
      </div>

      {/* Action bar */}
      <div
        className={cn(
          "mt-8 flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-5",
          "sm:sticky sm:bottom-0 sm:bg-[var(--surface)] sm:px-0 sm:py-4",
          "justify-between",
        )}
      >
        {/* Left: Cancel / Back */}
        <div className="flex items-center gap-2">
          {isFirstStep && !showReview ? (
            <Button
              type="button"
              variant="secondary"
              onClick={handleCancel}
            >
              Abbrechen
            </Button>
          ) : (
            <Button
              type="button"
              variant="secondary"
              iconLeft={<ArrowLeft className="h-4 w-4" />}
              onClick={handleBack}
              disabled={submitting}
            >
              Zurück
            </Button>
          )}
        </div>

        {/* Right: Next / Create */}
        <div>
          {showReview ? (
            <Button
              type="button"
              variant="primary"
              iconLeft={
                submitting ? undefined : (
                  <ClipboardCheck className="h-4 w-4" />
                )
              }
              loading={submitting}
              disabled={submitting}
              onClick={handleSubmit}
            >
              Team registrieren
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              iconRight={
                isLastVisibleStep ? undefined : (
                  <ArrowRight className="h-4 w-4" />
                )
              }
              onClick={handleNext}
            >
              {isLastVisibleStep ? "Prüfen" : "Weiter"}
            </Button>
          )}
        </div>
      </div>

      {/* Unsaved changes dialog */}
      {showDiscardDialog && (
        <DiscardDialog
          onKeep={() => setShowDiscardDialog(false)}
          onDiscard={handleConfirmDiscard}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Discard dialog
// ---------------------------------------------------------------------------

function DiscardDialog({
  onKeep,
  onDiscard,
}: {
  onKeep: () => void;
  onDiscard: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="discard-dialog-title"
      aria-describedby="discard-dialog-desc"
    >
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        aria-hidden="true"
        onClick={onKeep}
      />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-[var(--shadow-xl)]">
        <h3
          id="discard-dialog-title"
          className="text-base font-semibold text-[var(--foreground)]"
        >
          Änderungen verwerfen?
        </h3>
        <p
          id="discard-dialog-desc"
          className="mt-2 text-sm text-[var(--text-2)]"
        >
          Deine Eingaben wurden noch nicht gespeichert.
        </p>
        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onKeep}>
            Weiter bearbeiten
          </Button>
          <Button type="button" variant="danger" onClick={onDiscard}>
            Verwerfen
          </Button>
        </div>
      </div>
    </div>
  );
}
