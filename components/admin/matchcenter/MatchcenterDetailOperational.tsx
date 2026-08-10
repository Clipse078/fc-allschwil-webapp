"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  CircleAlert,
  ExternalLink,
  Loader2,
  Monitor,
  Save,
  Shirt,
  Users,
  Volleyball,
  X,
} from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/Badge";
import { SectionCard } from "@/components/ui/page/SectionCard";

// ── Types ─────────────────────────────────────────────────────────────────────

type TeamItem = {
  id: string;
  name: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  isActive: boolean;
};

/**
 * Canonical resource option — sourced from Facility → FacilityResource
 * (tenant-scoped, active/non-archived) rather than a static registry.
 * See MASTERDATA-CONSISTENCY-02.
 */
export type ResourceSelectOption = {
  code: string;
  label: string;
};

export type MatchcenterDetailOperationalProps = {
  matchId: string;
  homeAway: string | null;
  homeDisplayName: string;
  awayDisplayName: string;
  homeIsOwnTeam: boolean;
  awayIsOwnTeam: boolean;
  /** Current teamId on Event (the internal FC Allschwil team) */
  currentTeamId: string | null;
  /** Current pitch code */
  currentPitchCode: string | null;
  /** Current home dressing room code */
  currentHomeDressingRoomCode: string | null;
  /** Current away dressing room code */
  currentAwayDressingRoomCode: string | null;
  /** Current website visibility */
  currentWebsiteVisible: boolean;
  /** Current infoboard visibility */
  currentInfoboardVisible: boolean;
  /** ISO date string for infoboard preview link */
  matchDateIso: string;
  canManage: boolean;
  /**
   * Canonical active pitch resources (FULL_PITCH) for this tenant, sourced
   * via getFacilitiesForTenant. Newly created resources appear automatically;
   * archived resources disappear from new selections. Defaults to an empty
   * list so a currently-assigned historical code still remains selectable
   * even when no canonical options were supplied.
   */
  pitchOptions?: ResourceSelectOption[];
  /** Canonical active dressing-room resources (DRESSING_ROOM) for this tenant. */
  dressingRoomOptions?: ResourceSelectOption[];
};

/**
 * Merges the canonical option list with the currently-assigned code so that
 * a historical allocation referencing an archived/renamed-away resource
 * remains visible and readable in the select — it just won't be offered for
 * *new* selections beyond what canonical data provides.
 */
function withHistoricalFallback(
  options: ResourceSelectOption[],
  currentCode: string | null,
): ResourceSelectOption[] {
  if (!currentCode || options.some((opt) => opt.code === currentCode)) {
    return options;
  }
  return [...options, { code: currentCode, label: currentCode }];
}

// ── Readiness helpers ─────────────────────────────────────────────────────────

type ReadinessState = "ready" | "not-ready" | "not-relevant";

type ReadinessCheck = {
  label: string;
  passed: boolean;
};

function computeReadiness(
  homeAway: string | null,
  ownTeamAssigned: boolean,
  pitchCode: string | null,
  homeDressingRoomCode: string | null,
  awayDressingRoomCode: string | null,
  infoboardVisible: boolean,
): {
  state: ReadinessState;
  checks: ReadinessCheck[];
} {
  const normalized = homeAway?.trim().toUpperCase() ?? null;

  if (normalized !== "HOME") {
    return {
      state: "not-relevant",
      checks: [],
    };
  }

  const checks: ReadinessCheck[] = [
    { label: "Heimspiel bestätigt", passed: true },
    { label: "FC-Allschwil-Team zugeordnet", passed: ownTeamAssigned },
    { label: "Spielfeld zugeordnet", passed: Boolean(pitchCode?.trim()) },
    {
      label: "Garderobe Heimteam zugeordnet",
      passed: Boolean(homeDressingRoomCode?.trim()),
    },
    {
      label: "Garderobe Gastteam zugeordnet",
      passed: Boolean(awayDressingRoomCode?.trim()),
    },
    { label: "Für Infoboard freigegeben", passed: infoboardVisible },
  ];

  const allPassed = checks.every((c) => c.passed);

  return {
    state: allPassed ? "ready" : "not-ready",
    checks,
  };
}

/**
 * Computes a specific German allocation warning message for the infoboard
 * readiness section.
 *
 * Returns a message string when all of the following are true:
 *   - homeAway = "HOME"
 *   - infoboardVisible = true
 *   - at least one allocation is missing (pitch, home dressing room, or away dressing room)
 *
 * Returns null when no warning applies (away match, infoboard disabled, or fully allocated).
 *
 * Example messages:
 *   "Es fehlt noch die Platzzuteilung."
 *   "Es fehlen noch Heimkabine und Gästekabine."
 *   "Es fehlen noch Platz, Heimkabine und Gästekabine."
 */
export function computeAllocationWarning(
  homeAway: string | null,
  infoboardVisible: boolean,
  pitchCode: string | null,
  homeDressingRoomCode: string | null,
  awayDressingRoomCode: string | null,
): string | null {
  const isHome = homeAway?.trim().toUpperCase() === "HOME";
  if (!isHome || !infoboardVisible) return null;

  const missing: string[] = [];
  if (!pitchCode?.trim()) missing.push("Platz");
  if (!homeDressingRoomCode?.trim()) missing.push("Heimkabine");
  if (!awayDressingRoomCode?.trim()) missing.push("Gästekabine");

  if (missing.length === 0) return null;

  if (missing.length === 1) {
    const item = missing[0]!;
    // "die" for "Platz" → "die Platzzuteilung", for rooms use nominative
    if (item === "Platz") return "Es fehlt noch die Platzzuteilung.";
    return `Es fehlt noch ${item}.`;
  }

  const last = missing[missing.length - 1]!;
  const rest = missing.slice(0, -1);
  return `Es fehlen noch ${rest.join(", ")} und ${last}.`;
}

function formatTeamLabel(team: TeamItem): string {
  const suffix = [team.ageGroup, team.genderGroup]
    .filter(Boolean)
    .join(" / ");
  return suffix ? `${team.name} · ${suffix}` : team.name;
}

// ── Main component ────────────────────────────────────────────────────────────

export default function MatchcenterDetailOperational({
  matchId,
  homeAway,
  homeDisplayName,
  awayDisplayName,
  homeIsOwnTeam,
  awayIsOwnTeam,
  currentTeamId,
  currentPitchCode,
  currentHomeDressingRoomCode,
  currentAwayDressingRoomCode,
  currentWebsiteVisible,
  currentInfoboardVisible,
  matchDateIso,
  canManage,
  pitchOptions = [],
  dressingRoomOptions = [],
}: MatchcenterDetailOperationalProps) {
  const router = useRouter();
  const { toast } = useToast();

  // ── Form state ─────────────────────────────────────────────────────────────
  const [teamId, setTeamId] = useState(currentTeamId ?? "");
  const [pitchCode, setPitchCode] = useState(currentPitchCode ?? "");
  const [homeDressingRoomCode, setHomeDressingRoomCode] = useState(
    currentHomeDressingRoomCode ?? "",
  );
  const [awayDressingRoomCode, setAwayDressingRoomCode] = useState(
    currentAwayDressingRoomCode ?? "",
  );
  const [websiteVisible, setWebsiteVisible] = useState(currentWebsiteVisible);
  const [infoboardVisible, setInfoboardVisible] = useState(
    currentInfoboardVisible,
  );

  // ── Team loading ───────────────────────────────────────────────────────────
  const [teams, setTeams] = useState<TeamItem[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(false);
  const [teamsError, setTeamsError] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    setTeamsLoading(true);
    setTeamsError(null);

    try {
      const res = await fetch("/api/teams", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as
        | TeamItem[]
        | { error?: string }
        | null;

      if (!res.ok) {
        throw new Error(
          !Array.isArray(data)
            ? ((data as { error?: string })?.error ?? "Teams konnten nicht geladen werden.")
            : "Teams konnten nicht geladen werden.",
        );
      }

      const active = Array.isArray(data)
        ? data.filter((t) => t.isActive)
        : [];
      setTeams(active);
    } catch (err) {
      setTeamsError(
        err instanceof Error
          ? err.message
          : "Teams konnten nicht geladen werden.",
      );
    } finally {
      setTeamsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (canManage) {
      loadTeams();
    }
  }, [canManage, loadTeams]);

  // ── Save ───────────────────────────────────────────────────────────────────
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);

    try {
      const res = await fetch(`/api/matchcenter/${matchId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamId: teamId.trim() || null,
          pitchCode: pitchCode.trim() || null,
          homeDressingRoomCode: homeDressingRoomCode.trim() || null,
          awayDressingRoomCode: awayDressingRoomCode.trim() || null,
          websiteVisible,
          infoboardVisible,
        }),
      });

      const data = (await res.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!res.ok) {
        throw new Error(
          data?.error ?? "Änderungen konnten nicht gespeichert werden.",
        );
      }

      toast.success("Änderungen gespeichert.");
      router.refresh();
    } catch (err) {
      toast.danger(
        err instanceof Error
          ? err.message
          : "Änderungen konnten nicht gespeichert werden.",
        { duration: 6000 },
      );
    } finally {
      setSaving(false);
    }
  }

  // ── Derived values ─────────────────────────────────────────────────────────
  const normalizedHomeAway = homeAway?.trim().toUpperCase() ?? null;
  const isHomeMatch = normalizedHomeAway === "HOME";
  const isAwayMatch = normalizedHomeAway === "AWAY";

  const ownTeamAssigned = Boolean(teamId.trim());

  const { state: readinessState, checks: readinessChecks } = computeReadiness(
    homeAway,
    ownTeamAssigned,
    pitchCode,
    homeDressingRoomCode,
    awayDressingRoomCode,
    infoboardVisible,
  );

  const allocationWarning = computeAllocationWarning(
    homeAway,
    infoboardVisible,
    pitchCode,
    homeDressingRoomCode,
    awayDressingRoomCode,
  );

  const previewDate = matchDateIso.split("T")[0] ?? matchDateIso;
  const previewHref = `/dashboard/infoboard?date=${previewDate}`;

  // Canonical selectable options, plus the currently-assigned code so a
  // historical allocation referencing an archived/renamed resource stays
  // visible and readable even if it is no longer offered for new selections.
  const availablePitchOptions = withHistoricalFallback(pitchOptions, currentPitchCode);
  const availableHomeRoomOptions = withHistoricalFallback(
    dressingRoomOptions,
    currentHomeDressingRoomCode,
  );
  const availableAwayRoomOptions = withHistoricalFallback(
    dressingRoomOptions,
    currentAwayDressingRoomCode,
  );

  // ── Own-side context ───────────────────────────────────────────────────────
  // For FC Allschwil, the "own team" side is home when isOwnTeam is true for home,
  // or away when isOwnTeam is true for away. The team selector sets Event.teamId.
  const ownSideLabel =
    homeIsOwnTeam
      ? `${homeDisplayName} (Heim)`
      : awayIsOwnTeam
        ? `${awayDisplayName} (Gast)`
        : "FC Allschwil";

  return (
    <div className="space-y-5">
      {/* D2 — Infoboard Readiness */}
      <SectionCard
        title="Infoboard-Bereitschaft"
        description="Prüfung der Voraussetzungen für die Infoboard-Anzeige"
      >
        {readinessState === "not-relevant" ? (
          <div
            className="flex items-start gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3"
            data-testid="infoboard-readiness-not-relevant"
          >
            <X className="mt-0.5 h-5 w-5 shrink-0 text-slate-500" />
            <div>
              <p className="text-sm font-semibold text-slate-800">
                Nicht relevant
              </p>
              <p className="mt-1 text-sm text-slate-700">
                Auswärtsspiele werden nicht auf dem FC-Allschwil-Infoboard
                angezeigt.
              </p>
            </div>
          </div>
        ) : readinessState === "ready" ? (
          <div
            className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3"
            data-testid="infoboard-readiness-ready"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            <div>
              <p className="text-sm font-semibold text-emerald-900">Bereit</p>
              <p className="mt-1 text-sm text-emerald-800">
                Alle Infoboard-Voraussetzungen sind erfüllt.
              </p>
            </div>
          </div>
        ) : (
          <div
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
            data-testid="infoboard-readiness-not-ready"
          >
            <div className="flex items-start gap-3">
              <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
              <div>
                <p className="text-sm font-semibold text-amber-950">
                  Nicht bereit
                </p>
                <p className="mt-1 text-sm text-amber-900">
                  Nicht alle Voraussetzungen sind erfüllt.
                </p>
              </div>
            </div>
          </div>
        )}

        {readinessState !== "not-relevant" && (
          <ul className="mt-4 space-y-2">
            {readinessChecks.map((check) => (
              <li
                key={check.label}
                className="flex items-center gap-2 text-sm"
              >
                {check.passed ? (
                  <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <CircleAlert className="h-4 w-4 shrink-0 text-amber-600" />
                )}
                <span
                  className={
                    check.passed
                      ? "text-emerald-900"
                      : "text-amber-900"
                  }
                >
                  {check.label}
                </span>
              </li>
            ))}
          </ul>
        )}

        {allocationWarning && (
          <div
            className="mt-4 flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3"
            data-testid="infoboard-allocation-warning"
          >
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
            <div>
              <p className="text-sm font-semibold text-amber-950">
                Infoboard-Zuteilung unvollständig
              </p>
              <p
                className="mt-1 text-sm text-amber-900"
                data-testid="infoboard-allocation-warning-text"
              >
                {allocationWarning}
              </p>
            </div>
          </div>
        )}
      </SectionCard>

      {/* D3 — Team Assignment */}
      <SectionCard
        title="Teamzuordnung"
        description="Zuordnung des internen FC-Allschwil-Teams"
      >
        {teamsError ? (
          <div
            role="alert"
            className="fca-status-box fca-status-box-error"
          >
            {teamsError}
          </div>
        ) : null}

        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="fca-label">
              <Users className="inline h-3.5 w-3.5 align-text-bottom" />{" "}
              FC-Allschwil-Team ({ownSideLabel})
            </span>

            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              disabled={!canManage || teamsLoading || saving}
              className="fca-select"
              data-testid="team-assignment-select"
            >
              <option value="">
                {teamsLoading
                  ? "Teams laden..."
                  : "— Kein Team zugeordnet —"}
              </option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {formatTeamLabel(team)}
                </option>
              ))}
            </select>

            {!ownTeamAssigned && (
              <p className="text-xs text-amber-700">
                Kein internes Team zugeordnet.
              </p>
            )}
          </label>
        </div>
      </SectionCard>

      {/* D4 — Pitch Assignment */}
      <SectionCard
        title="Sportanlage und Spielfeld"
        description="Spielfeldwahl für dieses Match"
      >
        <label className="block space-y-2">
          <span className="fca-label">
            <Volleyball className="inline h-3.5 w-3.5 align-text-bottom" />{" "}
            Spielfeld
          </span>

          <select
            value={pitchCode}
            onChange={(e) => setPitchCode(e.target.value)}
            disabled={!canManage || saving}
            className="fca-select"
            data-testid="pitch-assignment-select"
          >
            <option value="">— Kein Spielfeld zugeordnet —</option>
            {availablePitchOptions.map((opt) => (
              <option key={opt.code} value={opt.code}>
                {opt.label}
              </option>
            ))}
          </select>

          {!pitchCode.trim() && (
            <p className="text-xs text-amber-700">
              Spielfeld fehlt.
            </p>
          )}
        </label>
      </SectionCard>

      {/* D5 — Dressing Room Assignment */}
      <SectionCard
        title="Garderobenzuteilung"
        description="Garderobenzuteilung für Heim- und Gastteam"
      >
        <div className="space-y-4">
          <label className="block space-y-2">
            <span className="fca-label">
              <Shirt className="inline h-3.5 w-3.5 align-text-bottom" />{" "}
              Garderobe Heimteam ({homeDisplayName})
            </span>

            <select
              value={homeDressingRoomCode}
              onChange={(e) => setHomeDressingRoomCode(e.target.value)}
              disabled={!canManage || saving}
              className="fca-select"
              data-testid="home-dressing-room-select"
            >
              <option value="">— Keine Garderobe zugeordnet —</option>
              {availableHomeRoomOptions.map((room) => (
                <option key={room.code} value={room.code}>
                  {room.label}
                </option>
              ))}
            </select>

            {!homeDressingRoomCode.trim() && (
              <p className="text-xs text-amber-700">
                Garderobe Heimteam fehlt.
              </p>
            )}
          </label>

          <label className="block space-y-2">
            <span className="fca-label">
              <Shirt className="inline h-3.5 w-3.5 align-text-bottom" />{" "}
              Garderobe Gastteam ({awayDisplayName})
            </span>

            <select
              value={awayDressingRoomCode}
              onChange={(e) => setAwayDressingRoomCode(e.target.value)}
              disabled={!canManage || saving}
              className="fca-select"
              data-testid="away-dressing-room-select"
            >
              <option value="">— Keine Garderobe zugeordnet —</option>
              {availableAwayRoomOptions.map((room) => (
                <option key={room.code} value={room.code}>
                  {room.label}
                </option>
              ))}
            </select>

            {!awayDressingRoomCode.trim() && (
              <p className="text-xs text-amber-700">
                Garderobe Gastteam fehlt.
              </p>
            )}
          </label>
        </div>
      </SectionCard>

      {/* D6 — Publication */}
      <SectionCard
        title="Veröffentlichung"
        description="Ausgabekanäle für dieses Match"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Auf Website anzeigen
              </p>
              <p className="text-xs text-[var(--muted)]">
                Das Spiel wird im Spielplan und in den nächsten Spielen auf der Website angezeigt.
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={websiteVisible}
              onClick={() => canManage && !saving && setWebsiteVisible((v) => !v)}
              disabled={!canManage || saving}
              data-testid="website-visible-toggle"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2 ${
                websiteVisible
                  ? "bg-emerald-500"
                  : "bg-[var(--border-strong)]"
              } ${!canManage ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  websiteVisible ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Auf Infoboard anzeigen
              </p>
              <p className="text-xs text-[var(--muted)]">
                {isAwayMatch
                  ? "Dieses Auswärtsspiel kann nicht auf dem FC-Allschwil-Infoboard veröffentlicht werden."
                  : "Sichtbar auf dem FC-Allschwil-Infoboard (Screen 1)."}
              </p>
            </div>

            <button
              type="button"
              role="switch"
              aria-checked={infoboardVisible}
              onClick={() =>
                canManage &&
                !saving &&
                !isAwayMatch &&
                setInfoboardVisible((v) => !v)
              }
              disabled={!canManage || saving || isAwayMatch}
              data-testid="infoboard-visible-toggle"
              aria-label="Auf Infoboard anzeigen"
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)] focus-visible:ring-offset-2 ${
                infoboardVisible && !isAwayMatch
                  ? "bg-emerald-500"
                  : "bg-[var(--border-strong)]"
              } ${!canManage || isAwayMatch ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
            >
              <span
                className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  infoboardVisible && !isAwayMatch
                    ? "translate-x-6"
                    : "translate-x-1"
                }`}
              />
            </button>
          </div>

          <p className="text-xs text-[var(--muted)]">
            Die Freigabe allein genügt nicht. Das Spiel wird nur angezeigt,
            wenn alle Publikationsregeln erfüllt sind.
          </p>
        </div>
      </SectionCard>

      {/* D7 — Save + D8 — Preview */}
      <div className="flex flex-wrap items-center gap-3">
        {canManage && (
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            data-testid="save-match-operational"
            className="fca-button-primary"
          >
            {saving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Wird gespeichert...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Änderungen speichern
              </>
            )}
          </button>
        )}

        <a
          href={previewHref}
          target="_blank"
          rel="noopener noreferrer"
          data-testid="infoboard-preview-link"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <Monitor className="h-3.5 w-3.5" />
          Infoboard-Vorschau öffnen
          <ExternalLink className="h-3 w-3 opacity-60" />
        </a>

        {readinessState === "not-ready" && (
          <Badge variant="warning" size="sm">
            <CircleAlert className="h-3 w-3" />
            Einrichtung erforderlich
          </Badge>
        )}
      </div>
    </div>
  );
}
