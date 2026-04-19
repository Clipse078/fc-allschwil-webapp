"use client";

import { useState } from "react";

type SendInviteButtonProps = {
  userId: string;
  accessState?: string | null;
};

export default function SendInviteButton({
  userId,
  accessState,
}: SendInviteButtonProps) {
  const [submitting, setSubmitting] = useState(false);

  const isResend = accessState === "INVITED";
  const buttonLabel = isResend ? "Einladung erneut senden" : "Einladung senden";
  const confirmText = isResend
    ? "Einladung erneut per E-Mail an diesen Benutzer senden?"
    : "Einladung jetzt per E-Mail an diesen Benutzer senden?";

  async function handleInvite() {
    const confirmed = window.confirm(confirmText);

    if (!confirmed) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch("/api/users/" + userId + "/invite", {
        method: "POST",
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Einladung konnte nicht versendet werden.");
      }

      const debugUrl =
        typeof data?.debugUrl === "string" && data.debugUrl.trim().length > 0
          ? data.debugUrl
          : null;

      if (debugUrl) {
        window.prompt("STAGE Test-Link für Einladung", debugUrl);
      } else {
        window.alert(data?.message ?? "Einladung erfolgreich versendet.");
      }

      window.location.reload();
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
      onClick={handleInvite}
      disabled={submitting}
      className="fca-button-primary"
    >
      {submitting ? "Sende..." : buttonLabel}
    </button>
  );
}