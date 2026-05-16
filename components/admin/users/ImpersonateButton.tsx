"use client";

import { useState } from "react";

type ImpersonateButtonProps = {
  userId: string;
};

export default function ImpersonateButton({ userId }: ImpersonateButtonProps) {
  const [submitting, setSubmitting] = useState(false);

  async function handleImpersonate() {
    const confirmed = window.confirm(
      "Wirklich als dieser Benutzer einloggen?"
    );

    if (!confirmed) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/users/" + userId + "/impersonate", {
        method: "POST",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Impersonation konnte nicht gestartet werden.");
      }

      window.location.href = "/dashboard";
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Ein Fehler ist aufgetreten."
      );
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleImpersonate}
      disabled={submitting}
      className="fca-button-secondary"
    >
      {submitting ? "Starte..." : "Login als Benutzer"}
    </button>
  );
}
