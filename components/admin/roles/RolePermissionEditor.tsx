"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, KeyRound, Loader2, Save, AlertTriangle } from "lucide-react";
import type {
  PermissionEditorModuleGroup,
} from "@/lib/roles/queries";

const MODULE_LABELS: Record<string, string> = {
  USERS: "Benutzer",
  SEASONS: "Saisons",
  TEAMS: "Teams",
  PEOPLE: "Personen",
  EVENTS: "Events",
  FIXTURES: "Spiele",
  WOCHENPLAN: "Wochenplan",
  NEWS: "News",
  WEBSITE: "Website",
  INFOBOARD: "Infoboard",
  FUNCTIONS: "Funktionen",
  TARGETS: "Ziele",
  MEETINGS: "Meetings",
  INITIATIVES: "Initiativen",
  TEMPLATES: "Vorlagen",
  REGISTRATIONS: "Registrierungen",
  TENANTS: "Tenants",
  ORG: "Organisation",
};

type Props = {
  roleId: string;
  roleName: string;
  moduleGroups: PermissionEditorModuleGroup[];
  initialAssignedKeys: string[];
};

/**
 * Inline permission editor for a single role.
 *
 * Renders all system permissions grouped by module as checkboxes.
 * Tracks local changes; a single "Speichern" button bulk-replaces the
 * role's permissions via PUT /api/roles/[id]/permissions.
 *
 * Warns after save that active users must re-login for the JWT to reflect
 * the new permission set (JWTs are not invalidated server-side).
 */
export default function RolePermissionEditor({
  roleId,
  roleName,
  moduleGroups,
  initialAssignedKeys,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [checkedKeys, setCheckedKeys] = useState<Set<string>>(
    new Set(initialAssignedKeys),
  );
  const [saveState, setSaveState] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const isDirty =
    checkedKeys.size !== initialAssignedKeys.length ||
    initialAssignedKeys.some((k) => !checkedKeys.has(k));

  function toggle(key: string, checked: boolean) {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
    setSaveState("idle");
    setErrorMsg(null);
  }

  function toggleModule(keys: string[], checked: boolean) {
    setCheckedKeys((prev) => {
      const next = new Set(prev);
      keys.forEach((k) => (checked ? next.add(k) : next.delete(k)));
      return next;
    });
    setSaveState("idle");
    setErrorMsg(null);
  }

  async function handleSave() {
    setSaveState("saving");
    setErrorMsg(null);
    try {
      const res = await fetch(`/api/roles/${roleId}/permissions`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissionKeys: Array.from(checkedKeys) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setErrorMsg(data?.error ?? "Fehler beim Speichern.");
        setSaveState("error");
        return;
      }
      setSaveState("saved");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setErrorMsg("Netzwerkfehler. Bitte erneut versuchen.");
      setSaveState("error");
    }
  }

  return (
    <div className="space-y-5">
      {/* Header bar with save button */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-[var(--muted)]" />
          <p className="text-sm font-semibold text-[var(--foreground)]">
            Berechtigungen bearbeiten
          </p>
          {isDirty && (
            <span className="inline-flex items-center rounded-full bg-amber-100 px-2 py-0.5 text-[0.68rem] font-semibold text-amber-700">
              Ungespeicherte Änderungen
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saveState === "saving" || isPending}
          className="flex items-center gap-2 rounded-[var(--radius-xl)] bg-[var(--blue)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--blue-dark)] disabled:opacity-50"
        >
          {saveState === "saving" || isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saveState === "saved" ? (
            <Check className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saveState === "saving" ? "Speichern…" : saveState === "saved" ? "Gespeichert" : "Speichern"}
        </button>
      </div>

      {/* JWT staleness warning — shown after save */}
      {saveState === "saved" && (
        <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-[12px] text-amber-800">
            Berechtigungen gespeichert. Nutzer mit der Rolle <strong>{roleName}</strong> müssen sich
            neu anmelden, damit die Änderungen in ihrer Sitzung wirksam werden.
          </p>
        </div>
      )}

      {/* Error */}
      {saveState === "error" && errorMsg && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-[12px] font-medium text-rose-700">
          {errorMsg}
        </div>
      )}

      {/* Permission checklist by module */}
      {moduleGroups.map(({ module, permissions }) => {
        const keys = permissions.map((p) => p.key);
        const checkedInModule = keys.filter((k) => checkedKeys.has(k)).length;
        const allChecked = checkedInModule === keys.length;
        const someChecked = checkedInModule > 0 && !allChecked;
        const moduleLabel = MODULE_LABELS[module] ?? module;

        return (
          <div key={module} className="sce-detail-section">
            <div className="sce-detail-section-header">
              <div className="flex items-center gap-3">
                <label className="flex cursor-pointer items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    ref={(el) => {
                      if (el) el.indeterminate = someChecked;
                    }}
                    onChange={(e) => toggleModule(keys, e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded accent-[var(--blue)]"
                  />
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {moduleLabel}
                  </span>
                </label>
                <span className="text-[0.68rem] text-[var(--muted)]">
                  {checkedInModule}/{keys.length}
                </span>
              </div>
            </div>
            <div className="sce-detail-section-body">
              <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                {permissions.map((perm) => (
                  <label
                    key={perm.id}
                    className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--surface)] px-3 py-2.5 transition hover:border-[var(--blue)] hover:bg-[var(--blue-light)]"
                  >
                    <input
                      type="checkbox"
                      checked={checkedKeys.has(perm.key)}
                      onChange={(e) => toggle(perm.key, e.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-[var(--blue)]"
                    />
                    <div className="min-w-0">
                      <p className="text-[0.78rem] font-semibold leading-snug text-[var(--foreground)]">
                        {perm.name}
                      </p>
                      <p className="mt-0.5 truncate font-mono text-[0.65rem] text-[var(--muted)]">
                        {perm.key}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        );
      })}

      {moduleGroups.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <KeyRound className="h-10 w-10 text-[var(--muted)]" />
          <p className="text-sm text-[var(--muted)]">
            Keine Berechtigungen in der Datenbank gefunden.
          </p>
        </div>
      )}
    </div>
  );
}
