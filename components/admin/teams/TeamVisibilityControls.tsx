"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Globe, Monitor } from "lucide-react";

type Props = {
  teamId: string;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  canManage: boolean;
  onVisibilityChange?: (values: {
    websiteVisible: boolean;
    infoboardVisible: boolean;
  }) => void;
};

function VisibilityToggle({
  label,
  icon,
  value,
  disabled,
  onChange,
}: {
  label: string;
  icon: React.ReactNode;
  value: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2">
      <span className="text-[var(--muted)]">{icon}</span>
      <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative ml-auto inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/30 disabled:cursor-not-allowed disabled:opacity-50 ${
          value ? "bg-emerald-500" : "bg-[var(--border-strong)]"
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-[22px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </div>
  );
}

/**
 * TEAM-COCKPIT-01D: immediate-save visibility controls for the Team header.
 */
export default function TeamVisibilityControls({
  teamId,
  websiteVisible,
  infoboardVisible,
  canManage,
  onVisibilityChange,
}: Props) {
  const router = useRouter();
  const [website, setWebsite] = useState(websiteVisible);
  const [infoboard, setInfoboard] = useState(infoboardVisible);
  const [busyField, setBusyField] = useState<"website" | "infoboard" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function persistVisibility(
    field: "websiteVisible" | "infoboardVisible",
    nextWebsite: boolean,
    nextInfoboard: boolean,
  ) {
    if (!canManage) {
      return;
    }

    setBusyField(field === "websiteVisible" ? "website" : "infoboard");
    setError(null);

    try {
      const response = await fetch(`/api/teams/${teamId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          websiteVisible: nextWebsite,
          infoboardVisible: nextInfoboard,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Sichtbarkeit konnte nicht gespeichert werden.");
      }

      onVisibilityChange?.({
        websiteVisible: nextWebsite,
        infoboardVisible: nextInfoboard,
      });
      router.refresh();
    } catch (err) {
      setWebsite(websiteVisible);
      setInfoboard(infoboardVisible);
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setBusyField(null);
    }
  }

  async function handleWebsiteChange(nextValue: boolean) {
    setWebsite(nextValue);
    await persistVisibility("websiteVisible", nextValue, infoboard);
  }

  async function handleInfoboardChange(nextValue: boolean) {
    setInfoboard(nextValue);
    await persistVisibility("infoboardVisible", website, nextValue);
  }

  return (
    <div className="space-y-2" data-testid="team-visibility-controls">
      <div className="flex flex-wrap items-center gap-2">
        <VisibilityToggle
          label="Website"
          icon={<Globe className="h-4 w-4" />}
          value={website}
          disabled={!canManage || busyField !== null}
          onChange={handleWebsiteChange}
        />
        <VisibilityToggle
          label="Infoboard"
          icon={<Monitor className="h-4 w-4" />}
          value={infoboard}
          disabled={!canManage || busyField !== null}
          onChange={handleInfoboardChange}
        />
      </div>
      {error ? <p className="text-xs font-medium text-[var(--sce-danger)]">{error}</p> : null}
    </div>
  );
}
