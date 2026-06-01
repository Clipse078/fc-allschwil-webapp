"use client";

import { useState } from "react";
import { LogIn } from "lucide-react";

type ImpersonateButtonProps = {
  userId: string;
  variant?: "hero" | "default";
};

export default function ImpersonateButton({
  userId,
  variant = "default",
}: ImpersonateButtonProps) {
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

  if (variant === "hero") {
    return (
      <button
        type="button"
        onClick={handleImpersonate}
        disabled={submitting}
        className="inline-flex items-center gap-1.5 rounded-lg border border-white/25 bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm transition hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <LogIn className="h-3.5 w-3.5" />
        {submitting ? "Starte..." : "Impersonieren"}
      </button>
    );
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
