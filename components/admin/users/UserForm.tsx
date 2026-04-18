"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type UserFormProps = {
  mode: "create" | "edit";
  userId?: string;
  initialValues?: {
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
  };
};

export default function UserForm({
  mode,
  userId,
  initialValues,
}: UserFormProps) {
  const router = useRouter();

  const [firstName, setFirstName] = useState(initialValues?.firstName ?? "");
  const [lastName, setLastName] = useState(initialValues?.lastName ?? "");
  const [email, setEmail] = useState(initialValues?.email ?? "");
  const [isActive, setIsActive] = useState(initialValues?.isActive ?? true);
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const url = mode === "create" ? "/api/users/create" : "/api/users/" + userId;
      const method = mode === "create" ? "POST" : "PATCH";

      const payload =
        mode === "create"
          ? { firstName, lastName, email, password }
          : { firstName, lastName, email, isActive };

      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      }

      router.push("/dashboard/users");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminSurfaceCard className="p-6">
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="fca-label">Vorname</span>
            <input
              className="fca-input"
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              required
            />
          </label>

          <label className="space-y-2">
            <span className="fca-label">Nachname</span>
            <input
              className="fca-input"
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              required
            />
          </label>
        </div>

        <label className="block space-y-2">
          <span className="fca-label">E-Mail</span>
          <input
            type="email"
            className="fca-input"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </label>

        {mode === "create" ? (
          <label className="block space-y-2">
            <span className="fca-label">Temporäres Passwort</span>
            <input
              type="password"
              className="fca-input"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
            />
          </label>
        ) : (
          <label className="fca-toggle-row">
            <span className="text-sm text-slate-700">Benutzer ist aktiv</span>
            <input
              type="checkbox"
              checked={isActive}
              onChange={(event) => setIsActive(event.target.checked)}
              className="fca-toggle-checkbox"
            />
          </label>
        )}

        {error ? (
          <div className="fca-status-box fca-status-box-error">{error}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="fca-button-primary"
          >
            {submitting
              ? "Speichern..."
              : mode === "create"
                ? "Benutzer erstellen"
                : "Benutzer speichern"}
          </button>

          <button
            type="button"
            onClick={() => router.push("/dashboard/users")}
            className="fca-button-secondary"
          >
            Abbrechen
          </button>
        </div>
      </form>
    </AdminSurfaceCard>
  );
}
