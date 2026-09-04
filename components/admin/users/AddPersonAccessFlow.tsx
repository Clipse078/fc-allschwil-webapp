"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Building2, Check, ChevronRight, Mail } from "lucide-react";
import EffectiveAccessSummary from "@/components/admin/users/EffectiveAccessSummary";
import type { EffectiveAccessModuleGroup } from "@/lib/roles/effective-access-summary";
import type { TenantPersonWithoutUser } from "@/lib/users/queries";

type RoleOption = { id: string; name: string; key: string; isSystem: boolean };
type OrgUnitOption = { id: string; name: string };

type ScopedDraft = {
  roleId: string;
  orgUnitId: string;
  scopeMode: "THIS_ORG_UNIT" | "THIS_ORG_UNIT_AND_DESCENDANTS";
};

type Props = {
  availableRoles: RoleOption[];
  availableOrgUnits: OrgUnitOption[];
  personsWithoutUser: TenantPersonWithoutUser[];
  clubAdminRoleKey: string;
};

const STEPS = ["Person", "Zugriff", "Überprüfen"] as const;

export default function AddPersonAccessFlow({
  availableRoles,
  availableOrgUnits,
  personsWithoutUser,
  clubAdminRoleKey,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [linkedPersonId, setLinkedPersonId] = useState<string>("");
  const [selectedRoleIds, setSelectedRoleIds] = useState<string[]>([]);
  const [scopedDrafts, setScopedDrafts] = useState<ScopedDraft[]>([]);
  const [previewGroups, setPreviewGroups] = useState<EffectiveAccessModuleGroup[]>([]);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const scopedEligibleRoles = useMemo(
    () => availableRoles.filter((r) => r.key !== clubAdminRoleKey),
    [availableRoles, clubAdminRoleKey],
  );

  const selectedRoles = availableRoles.filter((r) => selectedRoleIds.includes(r.id));
  const linkedPerson = personsWithoutUser.find((p) => p.personId === linkedPersonId);

  useEffect(() => {
    if (linkedPerson) {
      const [fn, ...rest] = linkedPerson.name.split(" ");
      setFirstName(fn ?? "");
      setLastName(rest.join(" "));
      setEmail(linkedPerson.email ?? "");
    }
  }, [linkedPerson]);

  useEffect(() => {
    if (step !== 2) return;
    setPreviewLoading(true);
    fetch("/api/tenant/effective-access/preview", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roleIds: selectedRoleIds }),
    })
      .then((res) => res.json())
      .then((data) => setPreviewGroups(data.summary ?? []))
      .catch(() => setPreviewGroups([]))
      .finally(() => setPreviewLoading(false));
  }, [step, selectedRoleIds]);

  function toggleRole(roleId: string) {
    setSelectedRoleIds((prev) =>
      prev.includes(roleId) ? prev.filter((id) => id !== roleId) : [...prev, roleId],
    );
  }

  function addScopedDraft() {
    const roleId = scopedEligibleRoles[0]?.id ?? "";
    const orgUnitId = availableOrgUnits[0]?.id ?? "";
    if (!roleId || !orgUnitId) return;
    setScopedDrafts((prev) => [...prev, { roleId, orgUnitId, scopeMode: "THIS_ORG_UNIT" }]);
  }

  async function submit(sendInvitation: boolean) {
    setError(null);
    setPending(true);
    try {
      const body: Record<string, unknown> = {
        sendInvitation,
        roleIds: selectedRoleIds,
        scopedRoles: scopedDrafts,
      };

      if (linkedPersonId) {
        body.personId = linkedPersonId;
      } else {
        body.firstName = firstName.trim();
        body.lastName = lastName.trim();
        body.email = email.trim();
      }

      const res = await fetch("/api/admin/users/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Speichern fehlgeschlagen.");
        return;
      }
      router.push(`/dashboard/admin/users/${data.userId}`);
      router.refresh();
    } catch {
      setError("Netzwerkfehler. Bitte versuche es erneut.");
    } finally {
      setPending(false);
    }
  }

  const canAdvanceStep0 =
    linkedPersonId ||
    (firstName.trim() && lastName.trim() && email.trim());

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div className="flex items-center justify-between gap-4">
        <Link
          href="/dashboard/admin/people-access"
          className="inline-flex items-center gap-1.5 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Personen &amp; Zugänge
        </Link>
      </div>

      {/* Step indicator */}
      <ol className="flex items-center gap-2">
        {STEPS.map((label, idx) => (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${
                idx <= step
                  ? "bg-[var(--blue,#2563EB)] text-white"
                  : "bg-[var(--surface-2)] text-[var(--muted)]"
              }`}
            >
              {idx < step ? <Check className="h-3.5 w-3.5" /> : idx + 1}
            </span>
            <span
              className={`text-sm font-medium ${
                idx === step ? "text-[var(--foreground)]" : "text-[var(--muted)]"
              }`}
            >
              {label}
            </span>
            {idx < STEPS.length - 1 ? (
              <ChevronRight className="h-4 w-4 text-[var(--muted)]" />
            ) : null}
          </li>
        ))}
      </ol>

      <div className="sce-detail-section">
        <div className="sce-detail-section-body space-y-6">
          {step === 0 ? (
            <>
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Person</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Stammdaten für die Person, die Zugang zu SportClubEvo erhalten soll.
                </p>
              </div>

              {personsWithoutUser.length > 0 ? (
                <div>
                  <label htmlFor="linked-person" className="mb-1 block text-xs font-medium text-[var(--foreground)]">
                    Bestehende Person verknüpfen (optional)
                  </label>
                  <select
                    id="linked-person"
                    value={linkedPersonId}
                    onChange={(e) => setLinkedPersonId(e.target.value)}
                    className="fca-input w-full"
                  >
                    <option value="">Neue Person anlegen</option>
                    {personsWithoutUser.map((p) => (
                      <option key={p.personId} value={p.personId}>
                        {p.name}
                        {p.email ? ` (${p.email})` : ""}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label htmlFor="add-firstName" className="mb-1 block text-xs font-medium text-[var(--foreground)]">
                    Vorname
                  </label>
                  <input
                    id="add-firstName"
                    type="text"
                    required
                    disabled={Boolean(linkedPersonId)}
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    className="fca-input w-full"
                  />
                </div>
                <div>
                  <label htmlFor="add-lastName" className="mb-1 block text-xs font-medium text-[var(--foreground)]">
                    Nachname
                  </label>
                  <input
                    id="add-lastName"
                    type="text"
                    required
                    disabled={Boolean(linkedPersonId)}
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    className="fca-input w-full"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="add-email" className="mb-1 block text-xs font-medium text-[var(--foreground)]">
                  E-Mail
                </label>
                <input
                  id="add-email"
                  type="email"
                  required
                  disabled={Boolean(linkedPersonId)}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="fca-input w-full"
                  placeholder="anna@example.com"
                />
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Zugriff</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Wähle eine oder mehrere Rollen. Bereichszuständigkeiten können optional ergänzt werden.
                </p>
              </div>

              <div className="space-y-2">
                {availableRoles.map((role) => (
                  <label
                    key={role.id}
                    className="flex cursor-pointer items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border)] px-4 py-3 hover:bg-[var(--surface-2)] transition"
                  >
                    <input
                      type="checkbox"
                      checked={selectedRoleIds.includes(role.id)}
                      onChange={() => toggleRole(role.id)}
                      className="h-4 w-4 rounded border-[var(--border)]"
                    />
                    <span className="text-sm font-medium text-[var(--foreground)]">{role.name}</span>
                  </label>
                ))}
              </div>

              {availableOrgUnits.length > 0 && scopedEligibleRoles.length > 0 ? (
                <div className="space-y-3 border-t border-[var(--border)] pt-5">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-[var(--foreground)]">Bereichszuständigkeiten</p>
                    <button
                      type="button"
                      onClick={addScopedDraft}
                      className="text-xs font-medium text-[var(--blue,#2563EB)] hover:underline"
                    >
                      + Bereich hinzufügen
                    </button>
                  </div>
                  {scopedDrafts.map((draft, idx) => (
                    <div key={idx} className="grid gap-2 rounded-[var(--radius-lg)] bg-[var(--surface-2)] p-3 sm:grid-cols-3">
                      <select
                        value={draft.roleId}
                        onChange={(e) => {
                          const next = [...scopedDrafts];
                          next[idx] = { ...next[idx], roleId: e.target.value };
                          setScopedDrafts(next);
                        }}
                        className="fca-input w-full text-sm"
                        aria-label="Rolle"
                      >
                        {scopedEligibleRoles.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                      <select
                        value={draft.orgUnitId}
                        onChange={(e) => {
                          const next = [...scopedDrafts];
                          next[idx] = { ...next[idx], orgUnitId: e.target.value };
                          setScopedDrafts(next);
                        }}
                        className="fca-input w-full text-sm"
                        aria-label="Bereich"
                      >
                        {availableOrgUnits.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-3.5 w-3.5 text-[var(--muted)]" />
                        <select
                          value={draft.scopeMode}
                          onChange={(e) => {
                            const next = [...scopedDrafts];
                            next[idx] = {
                              ...next[idx],
                              scopeMode: e.target.value as ScopedDraft["scopeMode"],
                            };
                            setScopedDrafts(next);
                          }}
                          className="fca-input w-full text-sm"
                          aria-label="Geltungsbereich"
                        >
                          <option value="THIS_ORG_UNIT">Nur dieser Bereich</option>
                          <option value="THIS_ORG_UNIT_AND_DESCENDANTS">Inkl. Unterbereiche</option>
                        </select>
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div>
                <h2 className="text-lg font-semibold text-[var(--foreground)]">Überprüfen</h2>
                <p className="mt-1 text-sm text-[var(--muted)]">
                  Kurze Zusammenfassung vor dem Speichern oder Versenden der Einladung.
                </p>
              </div>

              <div className="space-y-4 rounded-[var(--radius-xl)] bg-[var(--surface-2)] p-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Person</p>
                  <p className="mt-1 text-sm font-medium text-[var(--foreground)]">
                    {firstName} {lastName}
                  </p>
                  <p className="text-sm text-[var(--muted)]">{email}</p>
                </div>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Rollen</p>
                  {selectedRoles.length > 0 ? (
                    <ul className="mt-1 flex flex-wrap gap-1.5">
                      {selectedRoles.map((r) => (
                        <li key={r.id} className="sce-role-badge sce-role-badge-member">{r.name}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-[var(--muted)]">Keine Rollen gewählt</p>
                  )}
                </div>
                {scopedDrafts.length > 0 ? (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Bereiche</p>
                    <ul className="mt-1 space-y-1 text-sm text-[var(--foreground)]">
                      {scopedDrafts.map((d, idx) => {
                        const role = availableRoles.find((r) => r.id === d.roleId);
                        const unit = availableOrgUnits.find((u) => u.id === d.orgUnitId);
                        return (
                          <li key={idx}>
                            {role?.name} · {unit?.name}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : null}
              </div>

              <div>
                <p className="mb-3 text-xs font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">
                  Effektiver Zugriff
                </p>
                <EffectiveAccessSummary groups={previewGroups} loading={previewLoading} />
              </div>
            </>
          ) : null}

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-5">
            {step > 0 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                disabled={pending}
                className="fca-button-secondary text-sm"
              >
                Zurück
              </button>
            ) : (
              <span />
            )}

            {step < 2 ? (
              <button
                type="button"
                onClick={() => setStep((s) => s + 1)}
                disabled={step === 0 && !canAdvanceStep0}
                className="fca-button-primary text-sm"
              >
                Weiter
              </button>
            ) : (
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => submit(false)}
                  disabled={pending}
                  className="fca-button-secondary text-sm"
                >
                  Speichern ohne Einladung
                </button>
                <button
                  type="button"
                  onClick={() => submit(true)}
                  disabled={pending || !email.trim()}
                  className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] bg-[var(--blue,#2563EB)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
                >
                  <Mail className="h-3.5 w-3.5" />
                  {pending ? "Wird gesendet…" : "Einladung senden"}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
