"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type DeleteUserButtonProps = {
  userId: string;
  isActive: boolean;
};

export default function DeleteUserButton({
  userId,
  isActive,
}: DeleteUserButtonProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  async function handleToggle() {
    const confirmed = window.confirm(
      isActive
        ? "Benutzer wirklich deaktivieren?"
        : "Benutzer wieder aktivieren?"
    );

    if (!confirmed) {
      return;
    }

    setSubmitting(true);

    try {
      const detailResponse = await fetch("/api/users/" + userId, {
        method: "GET",
        cache: "no-store",
      });

      const detailData = await detailResponse.json();

      if (!detailResponse.ok) {
        throw new Error(detailData.error ?? "Benutzer konnte nicht geladen werden.");
      }

      const updateResponse = await fetch("/api/users/" + userId, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          firstName: detailData.firstName,
          lastName: detailData.lastName,
          email: detailData.email,
          isActive: !detailData.isActive,
        }),
      });

      const updateData = await updateResponse.json();

      if (!updateResponse.ok) {
        throw new Error(updateData.error ?? "Status konnte nicht aktualisiert werden.");
      }

      router.push("/dashboard/users");
      router.refresh();
    } catch (error) {
      window.alert(
        error instanceof Error ? error.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={submitting}
      className="fca-button-primary"
    >
      {submitting
        ? "Speichern..."
        : isActive
          ? "Benutzer deaktivieren"
          : "Benutzer aktivieren"}
    </button>
  );
}
