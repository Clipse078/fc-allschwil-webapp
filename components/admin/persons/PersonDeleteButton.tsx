"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";

type PersonDeleteButtonProps = {
  personId: string;
  personName: string;
};

export default function PersonDeleteButton({ personId, personName }: PersonDeleteButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/people/${personId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Person konnte nicht gelöscht werden.");
        return;
      }
      setOpen(false);
      router.push("/dashboard/persons");
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-transparent px-3.5 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
      >
        <Trash2 className="h-3.5 w-3.5" />
        Löschen
      </button>

      <Dialog
        open={open}
        onClose={() => setOpen(false)}
        title="Person dauerhaft löschen"
        description={`Möchtest du „${personName}" wirklich dauerhaft löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        footer={
          <div className="flex flex-col gap-2">
            {error ? (
              <p className="text-sm text-red-600">{error}</p>
            ) : null}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                onClick={() => setOpen(false)}
                disabled={loading}
              >
                Abbrechen
              </Button>
              <Button variant="danger" onClick={handleDelete} loading={loading}>
                Dauerhaft löschen
              </Button>
            </div>
          </div>
        }
      >
        <div className="space-y-3 text-sm text-[var(--text-2)]">
          <p>Folgendes wird dauerhaft gelöscht:</p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Der Personendatensatz mit allen Kontaktdaten</li>
            <li>Alle Organisationszuordnungen dieser Person</li>
          </ul>
          <p className="font-medium text-[var(--foreground)]">
            Nicht gelöscht:
          </p>
          <ul className="ml-4 list-disc space-y-1">
            <li>Verlinktes Benutzerkonto (wenn vorhanden) — nur der Link wird getrennt</li>
            <li>Kaderzugehörigkeiten in TeamCenter (historische Daten bleiben erhalten)</li>
          </ul>
        </div>
      </Dialog>
    </>
  );
}
