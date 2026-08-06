"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Loader2, Save } from "lucide-react";
import PermissionMatrixFields, {
  type PermissionMatrixModuleGroup,
} from "@/components/admin/roles/PermissionMatrixFields";

type CreateTenantRoleFormProps = {
  moduleGroups: PermissionMatrixModuleGroup[];
};

/**
 * Tenant custom role creation. Posts to `POST /api/tenant/roles` — scope
 * and tenant id are always forced server-side, this form never sends them.
 * Create + permission assignment happens in a single atomic request.
 */
export default function CreateTenantRoleForm({ moduleGroups }: CreateTenantRoleFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Der Rollenname ist erforderlich.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/tenant/roles", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          description: description.trim() || null,
          permissionKeys: Array.from(selectedKeys),
          isActive,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Rolle konnte nicht erstellt werden.");
        setSubmitting(false);
        return;
      }
      setDirty(false);
      router.push(`/dashboard/administration/roles/${data.role.id}`);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <p className="text-sm font-semibold text-[var(--foreground)]">Rollendetails</p>
        </div>
        <div className="sce-detail-section-body space-y-4">
          <div>
            <label htmlFor="role-name" className="sce-data-label">
              Rollenname
            </label>
            <input
              id="role-name"
              type="text"
              required
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setDirty(true);
              }}
              className="fca-input mt-1 w-full"
              placeholder="z. B. Dokumente Manager"
              maxLength={120}
            />
          </div>
          <div>
            <label htmlFor="role-description" className="sce-data-label">
              Beschreibung (optional)
            </label>
            <textarea
              id="role-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDirty(true);
              }}
              className="fca-input mt-1 w-full"
              rows={2}
            />
          </div>
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={isActive}
              onChange={(e) => {
                setIsActive(e.target.checked);
                setDirty(true);
              }}
              className="h-4 w-4 cursor-pointer rounded accent-[var(--blue)]"
            />
            <span className="text-sm font-medium text-[var(--foreground)]">Rolle ist aktiv</span>
          </label>
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-semibold text-[var(--foreground)]">Berechtigungen / Module</p>
        <PermissionMatrixFields
          moduleGroups={moduleGroups}
          selectedKeys={selectedKeys}
          onChange={(next) => {
            setSelectedKeys(next);
            setDirty(true);
          }}
        />
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <p className="text-[12px] font-medium text-rose-700">{error}</p>
        </div>
      )}

      <div className="flex items-center justify-end gap-3">
        {dirty && (
          <span className="text-[0.72rem] font-semibold text-amber-700">
            Ungespeicherte Änderungen
          </span>
        )}
        <button type="submit" disabled={submitting} className="fca-button-primary disabled:opacity-50">
          {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {submitting ? "Wird erstellt…" : "Rolle erstellen"}
        </button>
      </div>
    </form>
  );
}
