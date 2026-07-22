"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  Link2,
  Loader2,
  RefreshCw,
} from "lucide-react";

import { Dialog } from "@/components/ui/Dialog";
import { useToast } from "@/hooks/use-toast";
import type { MatchcenterSide } from "@/lib/matchcenter/types";

type TeamItem = {
  id: string;
  name: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  isActive: boolean;
};

type MatchTeamMappingDialogProps = {
  provider: string;
  externalSeasonId: number;
  sides: MatchcenterSide[];
};

function formatTeamLabel(team: TeamItem): string {
  const suffix = [
    team.ageGroup,
    team.genderGroup,
  ]
    .filter(Boolean)
    .join(" / ");

  return suffix
    ? `${team.name} · ${suffix}`
    : team.name;
}

export default function MatchTeamMappingDialog({
  provider,
  externalSeasonId,
  sides,
}: MatchTeamMappingDialogProps) {
  const router = useRouter();
  const { toast } = useToast();

  const unresolvedSides = useMemo(
    () =>
      sides.filter(
        (side) =>
          side.resolution === "UNRESOLVED" &&
          side.providerTeamId !== null,
      ),
    [sides],
  );

  const [open, setOpen] = useState(false);
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [selectedProviderTeamId, setSelectedProviderTeamId] =
    useState("");
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSide = useMemo(
    () =>
      unresolvedSides.find(
        (side) =>
          String(side.providerTeamId) ===
          selectedProviderTeamId,
      ) ?? null,
    [selectedProviderTeamId, unresolvedSides],
  );

  useEffect(() => {
    if (!open) {
      return;
    }

    let active = true;

    async function loadTeams() {
      setLoadingTeams(true);
      setError(null);

      try {
        const response = await fetch("/api/teams", {
          method: "GET",
          cache: "no-store",
        });

        const data = (await response
          .json()
          .catch(() => null)) as TeamItem[] | {
            error?: string;
          } | null;

        if (!response.ok) {
          throw new Error(
            !Array.isArray(data)
              ? data?.error ??
                  "Teams konnten nicht geladen werden."
              : "Teams konnten nicht geladen werden.",
          );
        }

        if (!active) {
          return;
        }

        const activeTeams = Array.isArray(data)
          ? data.filter((team) => team.isActive)
          : [];

        setTeams(activeTeams);
        setSelectedTeamId(
          (current) =>
            current || activeTeams[0]?.id || "",
        );
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(
          loadError instanceof Error
            ? loadError.message
            : "Teams konnten nicht geladen werden.",
        );
      } finally {
        if (active) {
          setLoadingTeams(false);
        }
      }
    }

    loadTeams();

    return () => {
      active = false;
    };
  }, [open]);

  function openDialog() {
    setError(null);
    setSelectedProviderTeamId(
      unresolvedSides[0]?.providerTeamId !== null
        ? String(unresolvedSides[0]?.providerTeamId)
        : "",
    );
    setSelectedTeamId("");
    setTeams([]);
    setOpen(true);
  }

  function closeDialog() {
    if (submitting) {
      return;
    }

    setOpen(false);
    setError(null);
  }

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !selectedSide ||
      selectedSide.providerTeamId === null ||
      !selectedTeamId
    ) {
      setError(
        "Bitte Provider-Team und internes Team auswählen.",
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(
        "/api/matchcenter/team-mappings",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            provider,
            externalTeamId:
              selectedSide.providerTeamId,
            externalSeasonId,
            teamId: selectedTeamId,
            providerTeamName:
              selectedSide.providerTeamName,
          }),
        },
      );

      const data = (await response
        .json()
        .catch(() => null)) as {
          error?: string;
          requiresScheduleSync?: boolean;
        } | null;

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Team-Zuordnung konnte nicht gespeichert werden.",
        );
      }

      setOpen(false);

      toast.success(
        "Team-Zuordnung gespeichert. Bitte den Spielplan synchronisieren, damit betroffene Matches aktualisiert werden.",
        {
          duration: 7000,
        },
      );

      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Team-Zuordnung konnte nicht gespeichert werden.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (unresolvedSides.length === 0) {
    return null;
  }

  return (
    <>
      <button
        type="button"
        onClick={openDialog}
        className="inline-flex items-center gap-1.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2 text-sm font-semibold text-amber-900 transition hover:bg-amber-100"
      >
        <Link2 className="h-3.5 w-3.5" />
        Team zuordnen
      </button>

      <Dialog
        open={open}
        onClose={closeDialog}
        title="Provider-Team zuordnen"
        description="Ordne ein externes Provider-Team dauerhaft einem internen Club-Team zu."
        size="md"
      >
        <form
          onSubmit={handleSubmit}
          className="space-y-5"
        >
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
            <div className="flex items-start gap-3">
              <RefreshCw className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />

              <p className="text-sm leading-relaxed text-amber-900">
                Nach dem Speichern ist eine
                Spielplan-Synchronisierung erforderlich.
                Erst danach werden bestehende Matches mit
                der neuen Zuordnung aktualisiert.
              </p>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="fca-label">
              Provider-Team
            </span>

            <select
              value={selectedProviderTeamId}
              onChange={(event) =>
                setSelectedProviderTeamId(
                  event.target.value,
                )
              }
              className="fca-select"
              required
              disabled={submitting}
            >
              <option value="">
                Bitte wählen
              </option>

              {unresolvedSides.map((side) => (
                <option
                  key={side.providerTeamId}
                  value={String(side.providerTeamId)}
                >
                  {side.providerTeamName?.trim() ||
                    side.displayName}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="fca-label">
              Internes Team
            </span>

            <select
              value={selectedTeamId}
              onChange={(event) =>
                setSelectedTeamId(event.target.value)
              }
              className="fca-select"
              required
              disabled={
                loadingTeams ||
                submitting ||
                teams.length === 0
              }
            >
              <option value="">
                {loadingTeams
                  ? "Teams laden..."
                  : teams.length === 0
                    ? "Keine aktiven Teams vorhanden"
                    : "Bitte wählen"}
              </option>

              {teams.map((team) => (
                <option
                  key={team.id}
                  value={team.id}
                >
                  {formatTeamLabel(team)}
                </option>
              ))}
            </select>
          </label>

          {error ? (
            <div
              role="alert"
              className="fca-status-box fca-status-box-error"
            >
              {error}
            </div>
          ) : null}

          <div className="flex flex-wrap justify-end gap-3">
            <button
              type="button"
              onClick={closeDialog}
              disabled={submitting}
              className="fca-button-secondary"
            >
              Abbrechen
            </button>

            <button
              type="submit"
              disabled={
                submitting ||
                loadingTeams ||
                !selectedProviderTeamId ||
                !selectedTeamId
              }
              className="fca-button-primary"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Wird gespeichert...
                </>
              ) : (
                <>
                  <Link2 className="h-4 w-4" />
                  Zuordnung speichern
                </>
              )}
            </button>
          </div>
        </form>
      </Dialog>
    </>
  );
}