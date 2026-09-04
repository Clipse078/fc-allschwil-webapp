"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Check, KeyRound, Loader2, Save } from "lucide-react";
import PermissionMatrixFields, {
  type PermissionMatrixModuleGroup,
} from "@/components/admin/roles/PermissionMatrixFields";

type Props = {
  roleId: string;
  roleName: string;
  isArchived: boolean;
  moduleGroups: PermissionMatrixModuleGroup[];
  initialAssignedKeys: string[];
  lockedKeys: string[];
};

/**
 * Tenant role permission matrix editor. Every write goes through
 * `PUT /api/tenant/roles/[id]/permissions`, which re-validates scope,
 * ownership, and essential-permission locks server-side — the locked
 * locked toggles here are a UX convenience, not the enforcement boundary.
 */
export default function TenantRolePermissionEditor({
  roleId,
  roleName,
  isArchived,
  moduleGroups,
  initialAssignedKeys,
  lockedKeys,
}: Props) {
  const router = useRouter();
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set(initialAssignedKeys));
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lockedKeySet = new Set(lockedKeys);

  const isDirty =
    selectedKeys.size !== initialAssignedKeys.length ||
    initialAssignedKeys.some((k) => !selectedKeys.has(k));

  async function handleSave() {
    setSaveState("saving");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/tenant/roles/${roleId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionKeys: Array.from(selectedKeys) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data?.error ?? "Fehler beim Speichern.");
        setSaveState("error");
        return;
      }
      setSaveState("saved");
      router.refresh();
    } catch {
      setErrorMsg("Netzwerkfehler. Bitte erneut versuchen.");
      setSaveState("error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[var(--muted)]" />
          <p className="text-sm font-semibold text-[var(--foreground)]">Berechtigungen bearbeiten</p>
          {isDirty && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[0.68rem] font-semibold text-amber-700">
              Ungespeicherte Änderungen
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saveState === "saving" || isArchived}
          className="fca-button-primary disabled:opacity-50"
        >
          {saveState === "saving" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saveState === "saved" ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saveState === "saving" ? "Speichern…" : saveState === "saved" ? "Gespeichert" : "Speichern"}
        </button>
      </div>

      {isArchived && (
        <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-slate-200 bg-slate-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
          <p className="text-[12px] text-slate-700">
            &quot;{roleName}&quot; ist archiviert. Reaktiviere die Rolle, um Berechtigungen zu bearbeiten.
          </p>
        </div>
      )}

      {saveState === "error" && errorMsg && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-medium text-rose-700">
          {errorMsg}
        </div>
      )}

      <PermissionMatrixFields
        moduleGroups={moduleGroups}
        selectedKeys={selectedKeys}
        lockedKeys={lockedKeySet}
        onChange={(next) => {
          setSelectedKeys(next);
          setSaveState("idle");
          setErrorMsg(null);
        }}
        disabled={isArchived}
      />
    </div>
  );
}
