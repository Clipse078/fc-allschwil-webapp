"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";

type Props = {
  open: boolean;
  onClose: () => void;
  tenantSlug: string;
  registrationId: string;
  currentEmail: string;
  canEdit: boolean;
  onSaved: (nextEmail: string) => void;
};

export function ContactEmailEditDialog({
  open,
  onClose,
  tenantSlug,
  registrationId,
  currentEmail,
  canEdit,
  onSaved,
}: Props) {
  const [email, setEmail] = useState(currentEmail);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const normalizedCurrent = useMemo(() => currentEmail.trim().toLowerCase(), [currentEmail]);

  useEffect(() => {
    if (!open) return;
    setEmail(currentEmail);
    setError(null);
  }, [currentEmail, open]);

  const save = async () => {
    if (!canEdit || saving) return;
    const next = email.trim();
    if (!next) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/registrations/${encodeURIComponent(registrationId)}/contact-email`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: next }),
        },
      );
      const payload = (await res.json()) as { email?: string; error?: string };
      if (!res.ok) {
        throw new Error(payload.error ?? "E-Mail-Adresse konnte nicht gespeichert werden.");
      }
      const updated = payload.email ?? next;
      onSaved(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "E-Mail-Adresse konnte nicht gespeichert werden.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={() => (saving ? null : onClose())}
      title="E-Mail-Adresse ändern"
      description="Diese Adresse wird für zukünftige Kommunikation verwendet. Frühere Nachrichten bleiben unverändert."
      footer={
        <div className="flex w-full justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold text-[var(--foreground)] hover:bg-[var(--surface-2)] disabled:opacity-60"
            onClick={onClose}
            disabled={saving}
          >
            Abbrechen
          </button>
          <button
            type="button"
            className="fca-button-primary gap-2 disabled:cursor-not-allowed disabled:opacity-60"
            onClick={() => void save()}
            disabled={saving || !email.trim() || email.trim().toLowerCase() === normalizedCurrent}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : null}
            Speichern
          </button>
        </div>
      }
      size="sm"
    >
      <label className="block">
        <span className="mb-1.5 block text-xs font-semibold text-[var(--text-2)]">
          Neue E-Mail-Adresse
        </span>
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={!canEdit || saving}
          className="fca-input w-full"
          placeholder="name@example.com"
          inputMode="email"
          autoComplete="email"
        />
      </label>
      {error ? <p className="mt-2 text-xs text-rose-600">{error}</p> : null}
    </Dialog>
  );
}

