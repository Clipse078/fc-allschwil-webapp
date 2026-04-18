"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type ActivateSeasonButtonProps = {
  seasonId: string;
  seasonName: string;
  isActive: boolean;
};

export default function ActivateSeasonButton({
  seasonId,
  seasonName,
  isActive,
}: ActivateSeasonButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleActivate() {
    if (isActive) {
      return;
    }

    const confirmed = window.confirm(
      'Saison "' +
        seasonName +
        '" wirklich als aktiv setzen? Die bisher aktive Saison wird dabei automatisch deaktiviert.'
    );

    if (!confirmed) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/seasons/" + seasonId + "/activate", {
        method: "POST",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Saison konnte nicht aktiviert werden.");
      }

      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (isActive) {
    return (
      <span className="fca-button-primary cursor-default opacity-80">
        Aktiv
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleActivate}
      disabled={submitting}
      className="fca-button-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      {submitting ? "Aktiviere..." : "Als aktiv setzen"}
    </button>
  );
}
