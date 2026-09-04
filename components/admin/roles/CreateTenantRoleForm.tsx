"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  ChevronRight,
  Loader2,
  Shield,
} from "lucide-react";
import PermissionMatrixFields, {
  type PermissionMatrixModuleGroup,
} from "@/components/admin/roles/PermissionMatrixFields";
import WizardStepIndicator from "@/components/admin/teams/registration/WizardStepIndicator";
import { SectionCard } from "@/components/ui/page/SectionCard";
import { SwitchToggle } from "@/components/ui/SwitchToggle";
import {
  buildSelectedPermissionSummary,
  isDangerousPermission,
} from "@/lib/roles/permission-metadata";

type CreateTenantRoleFormProps = {
  moduleGroups: PermissionMatrixModuleGroup[];
};

const STEPS = [
  { index: 0, label: "Basisdaten" },
  { index: 1, label: "Berechtigungen" },
  { index: 2, label: "Überprüfen" },
] as const;

/**
 * Premium three-step tenant role creation flow. Posts to `POST /api/tenant/roles`
 * — scope and tenant id are always forced server-side.
 */
export default function CreateTenantRoleForm({ moduleGroups }: CreateTenantRoleFormProps) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const permissionSummary = useMemo(
    () => buildSelectedPermissionSummary(moduleGroups, selectedKeys),
    [moduleGroups, selectedKeys],
  );

  const selectedCount = selectedKeys.size;
  const dangerousCount = Array.from(selectedKeys).filter(isDangerousPermission).length;

  async function handleSubmit() {
    setError(null);

    if (!name.trim()) {
      setError("Der Rollenname ist erforderlich.");
      setStep(0);
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
      router.push(`/dashboard/administration/roles/${data.role.id}`);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte erneut versuchen.");
      setSubmitting(false);
    }
  }

  function goToPermissions() {
    if (!name.trim()) {
      setError("Der Rollenname ist erforderlich.");
      return;
    }
    setError(null);
    setStep(1);
  }

  return (
    <div className="space-y-8">
      <WizardStepIndicator
        steps={[...STEPS]}
        currentStep={step}
        completedUpTo={step - 1}
      />

      <div className="grid gap-8 lg:grid-cols-12 lg:items-start">
        <div className="space-y-6 lg:col-span-8">
          {step === 0 && (
            <SectionCard title="Rollenidentität" description="Grundlegende Angaben zur neuen Rolle.">
              <div className="space-y-4">
                <div>
                  <label htmlFor="role-name" className="sce-data-label">
                    Rollenname
                  </label>
                  <input
                    id="role-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="fca-input mt-1 w-full"
                    placeholder="z. B. Platzkoordinator"
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
                    onChange={(e) => setDescription(e.target.value)}
                    className="fca-input mt-1 w-full"
                    rows={3}
                    placeholder="Kurze Beschreibung, wofür diese Rolle gedacht ist."
                  />
                </div>

                <SwitchToggle
                  id="role-is-active"
                  label="Rolle ist aktiv"
                  description="Inaktive Rollen können nicht zugewiesen werden."
                  checked={isActive}
                  onChange={setIsActive}
                />
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  type="button"
                  onClick={goToPermissions}
                  className="fca-button-primary"
                >
                  Weiter zu Berechtigungen
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </SectionCard>
          )}

          {step === 1 && (
            <SectionCard>
              <PermissionMatrixFields
                moduleGroups={moduleGroups}
                selectedKeys={selectedKeys}
                onChange={setSelectedKeys}
              />

              <div className="mt-6 flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                <button
                  type="button"
                  onClick={() => setStep(0)}
                  className="fca-button-secondary"
                >
                  Zurück
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setError(null);
                    setStep(2);
                  }}
                  className="fca-button-primary"
                >
                  Weiter zur Überprüfung
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </SectionCard>
          )}

          {step === 2 && (
            <SectionCard
              title="Angaben überprüfen"
              description="Prüfe die Rollendetails und Berechtigungen vor dem Erstellen."
            >
              <div className="space-y-6">
                <dl className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <dt className="text-xs font-medium text-[var(--muted)]">Rollenname</dt>
                    <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                      {name.trim() || "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-[var(--muted)]">Status</dt>
                    <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                      {isActive ? "Aktiv" : "Inaktiv"}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium text-[var(--muted)]">Beschreibung</dt>
                    <dd className="mt-1 text-sm text-[var(--foreground)]">
                      {description.trim() || "Keine Beschreibung"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium text-[var(--muted)]">Berechtigungen</dt>
                    <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                      {selectedCount} ausgewählt
                      {dangerousCount > 0 ? (
                        <span className="ml-2 text-xs font-medium text-amber-700">
                          ({dangerousCount} kritisch)
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </dl>

                {permissionSummary.length > 0 ? (
                  <div className="space-y-4">
                    {permissionSummary.map((group) => (
                      <div key={group.module}>
                        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                          {group.moduleLabel}
                        </p>
                        <ul className="mt-2 space-y-1.5">
                          {group.items.map((item) => (
                            <li
                              key={item.key}
                              className={`flex items-center gap-2 text-sm ${
                                item.dangerous
                                  ? "text-amber-800"
                                  : "text-[var(--foreground)]"
                              }`}
                            >
                              {item.dangerous ? (
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                              ) : (
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" aria-hidden="true" />
                              )}
                              {item.label}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[var(--muted)]">
                    Keine Berechtigungen ausgewählt. Die Rolle wird ohne Zugriffsrechte erstellt.
                  </p>
                )}

                {error ? (
                  <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
                    <p className="text-[12px] font-medium text-rose-700">{error}</p>
                  </div>
                ) : null}

                <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] pt-4">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="fca-button-secondary"
                    disabled={submitting}
                  >
                    Zurück
                  </button>
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting}
                    className="fca-button-primary disabled:opacity-50"
                  >
                    {submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Shield className="h-4 w-4" />
                    )}
                    {submitting ? "Wird erstellt…" : "Rolle erstellen"}
                  </button>
                </div>
              </div>
            </SectionCard>
          )}

          {error && step !== 2 ? (
            <div className="flex items-start gap-3 rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
              <p className="text-[12px] font-medium text-rose-700">{error}</p>
            </div>
          ) : null}
        </div>

        <aside className="lg:col-span-4">
          <div className="lg:sticky lg:top-6">
            <RolePreviewPanel
              name={name}
              description={description}
              isActive={isActive}
              selectedCount={selectedCount}
              permissionSummary={permissionSummary}
              step={step}
              onContinue={() => {
                if (step === 0) goToPermissions();
                else if (step === 1) setStep(2);
              }}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}

type RolePreviewPanelProps = {
  name: string;
  description: string;
  isActive: boolean;
  selectedCount: number;
  permissionSummary: ReturnType<typeof buildSelectedPermissionSummary>;
  step: number;
  onContinue: () => void;
};

function RolePreviewPanel({
  name,
  description,
  isActive,
  selectedCount,
  permissionSummary,
  step,
  onContinue,
}: RolePreviewPanelProps) {
  const displayName = name.trim() || "Neue Rolle";

  return (
    <SectionCard
      title="Rolle"
      description="Vorschau der gewählten Berechtigungen."
      accent={selectedCount > 0}
    >
      <div className="space-y-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[var(--sce-primary)]/10 text-[var(--sce-primary)]">
            <Shield className="h-5 w-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
              {displayName}
            </p>
            <p className="mt-0.5 text-xs text-[var(--text-2)] line-clamp-3">
              {description.trim() || "Noch keine Beschreibung"}
            </p>
            <p className="mt-2 text-[0.68rem] font-medium text-[var(--muted)]">
              {isActive ? "Aktiv" : "Inaktiv"} · {selectedCount} Berechtigung
              {selectedCount === 1 ? "" : "en"}
            </p>
          </div>
        </div>

        {permissionSummary.length > 0 ? (
          <div className="max-h-64 space-y-3 overflow-y-auto border-t border-[var(--border)] pt-3">
            {permissionSummary.map((group) => (
              <div key={group.module}>
                <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                  {group.moduleLabel}
                </p>
                <ul className="mt-1 space-y-0.5">
                  {group.items.slice(0, 4).map((item) => (
                    <li
                      key={item.key}
                      className={`truncate text-xs ${
                        item.dangerous ? "text-amber-700" : "text-[var(--text-2)]"
                      }`}
                    >
                      {item.label}
                    </li>
                  ))}
                  {group.items.length > 4 ? (
                    <li className="text-xs text-[var(--muted)]">
                      +{group.items.length - 4} weitere
                    </li>
                  ) : null}
                </ul>
              </div>
            ))}
          </div>
        ) : (
          <p className="border-t border-[var(--border)] pt-3 text-xs text-[var(--muted)]">
            Noch keine Berechtigungen ausgewählt.
          </p>
        )}

        {step < 2 ? (
          <div className="border-t border-[var(--border)] pt-4">
            <p className="text-xs font-semibold text-[var(--foreground)]">Nächster Schritt</p>
            <p className="mt-1 text-xs text-[var(--text-2)]">
              {step === 0
                ? "Wähle die passenden Berechtigungen für diese Rolle."
                : "Überprüfe die Angaben und erstelle die Rolle."}
            </p>
            <button
              type="button"
              onClick={onContinue}
              className="fca-button-primary mt-3 w-full"
            >
              {step === 0 ? "Weiter zu Berechtigungen" : "Weiter zur Überprüfung"}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}
