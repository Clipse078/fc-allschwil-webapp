"use client";

import { useState } from "react";
import { Mail, RotateCcw, X, Plus } from "lucide-react";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import type { InvitationListItem } from "@/lib/invitations/service";

type Props = {
  initialInvitations: InvitationListItem[];
  canInvite: boolean;
};

type ActionState = "idle" | "loading" | "error";

export default function InvitationsPanel({ initialInvitations, canInvite }: Props) {
  const [invitations, setInvitations] = useState(initialInvitations);
  const [actionState, setActionState] = useState<Record<string, ActionState>>({});
  const [errorMsg, setErrorMsg] = useState<Record<string, string>>({});

  // ── Invite dialog state ────────────────────────────────────────────────────
  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteMode, setInviteMode] = useState<"existing" | "new">("existing");
  const [invitePersonId, setInvitePersonId] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteFirstName, setInviteFirstName] = useState("");
  const [inviteLastName, setInviteLastName] = useState("");
  const [inviteError, setInviteError] = useState("");
  const [isInviting, setIsInviting] = useState(false);

  function pending() {
    return invitations.filter((i) => i.status === "PENDING");
  }

  async function handleResend(id: string) {
    setActionState((s) => ({ ...s, [id]: "loading" }));
    setErrorMsg((e) => ({ ...e, [id]: "" }));
    try {
      const res = await fetch(`/api/invitations/${id}/resend`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setErrorMsg((e) => ({ ...e, [id]: d.error ?? "Fehler" }));
        setActionState((s) => ({ ...s, [id]: "error" }));
      } else {
        setActionState((s) => ({ ...s, [id]: "idle" }));
      }
    } catch {
      setErrorMsg((e) => ({ ...e, [id]: "Verbindungsfehler" }));
      setActionState((s) => ({ ...s, [id]: "error" }));
    }
  }

  async function handleRevoke(id: string) {
    if (!confirm("Einladung wirklich widerrufen?")) return;
    setActionState((s) => ({ ...s, [id]: "loading" }));
    try {
      const res = await fetch(`/api/invitations/${id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({})) as { error?: string };
        setErrorMsg((e) => ({ ...e, [id]: d.error ?? "Fehler" }));
        setActionState((s) => ({ ...s, [id]: "error" }));
      } else {
        setInvitations((prev) =>
          prev.map((inv) => inv.id === id ? { ...inv, status: "REVOKED" as const } : inv),
        );
        setActionState((s) => ({ ...s, [id]: "idle" }));
      }
    } catch {
      setErrorMsg((e) => ({ ...e, [id]: "Verbindungsfehler" }));
      setActionState((s) => ({ ...s, [id]: "error" }));
    }
  }

  async function handleInvite() {
    setInviteError("");
    if (!inviteEmail.includes("@")) {
      setInviteError("Gültige E-Mail-Adresse erforderlich.");
      return;
    }
    if (inviteMode === "existing" && !invitePersonId) {
      setInviteError("Person-ID erforderlich.");
      return;
    }
    if (inviteMode === "new" && (!inviteFirstName || !inviteLastName)) {
      setInviteError("Vor- und Nachname erforderlich.");
      return;
    }

    setIsInviting(true);
    try {
      const body: Record<string, string> = { email: inviteEmail };
      if (inviteMode === "existing") {
        body.personId = invitePersonId;
      } else {
        body.firstName = inviteFirstName;
        body.lastName = inviteLastName;
      }

      const res = await fetch("/api/invitations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const d = await res.json().catch(() => ({})) as {
        error?: string;
        invitationId?: string;
        personId?: string;
      };

      if (!res.ok) {
        setInviteError(d.error ?? "Fehler beim Erstellen der Einladung.");
        return;
      }

      // Reload invitations list
      const listRes = await fetch("/api/invitations");
      if (listRes.ok) {
        const listData = await listRes.json() as { invitations: InvitationListItem[] };
        setInvitations(listData.invitations);
      }

      setShowInviteDialog(false);
      resetInviteForm();
    } catch {
      setInviteError("Verbindungsfehler.");
    } finally {
      setIsInviting(false);
    }
  }

  function resetInviteForm() {
    setInvitePersonId("");
    setInviteEmail("");
    setInviteFirstName("");
    setInviteLastName("");
    setInviteError("");
    setInviteMode("existing");
  }

  const pendingInvitations = pending();

  return (
    <div className="sce-detail-section">
      <div className="sce-detail-section-header">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-[var(--muted)]" />
            <p className="text-xs font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
              Ausstehende Einladungen
            </p>
            {pendingInvitations.length > 0 && (
              <span className="sce-count-badge">{pendingInvitations.length}</span>
            )}
          </div>
          {canInvite && (
            <button
              onClick={() => setShowInviteDialog(true)}
              className="inline-flex items-center gap-1.5 rounded-[var(--radius-md)] border border-[var(--border)] bg-white px-2.5 py-1.5 text-xs font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)] transition"
            >
              <Plus className="h-3.5 w-3.5" />
              Einladen
            </button>
          )}
        </div>
      </div>

      <div className="sce-detail-section-body">
        {pendingInvitations.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Keine ausstehenden Einladungen.</p>
        ) : (
          <ul className="space-y-2">
            {pendingInvitations.map((inv) => (
              <li
                key={inv.id}
                className="flex items-center justify-between gap-3 rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2.5"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--foreground)]">
                    {inv.person.firstName} {inv.person.lastName}
                  </p>
                  <p className="truncate text-xs text-[var(--muted)]">{inv.email}</p>
                  <p className="text-xs text-[var(--muted)]">
                    Läuft ab: {new Date(inv.expiresAt).toLocaleDateString("de-CH")}
                  </p>
                  {errorMsg[inv.id] && (
                    <p className="text-xs text-red-600">{errorMsg[inv.id]}</p>
                  )}
                </div>
                <div className="flex items-center gap-1 flex-shrink-0">
                  <AdminStatusPill label="Ausstehend" tone="warning" />
                  {canInvite && (
                    <>
                      <button
                        onClick={() => handleResend(inv.id)}
                        disabled={actionState[inv.id] === "loading"}
                        title="Erneut senden"
                        className="p-1.5 rounded text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-2)] transition disabled:opacity-40"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleRevoke(inv.id)}
                        disabled={actionState[inv.id] === "loading"}
                        title="Widerrufen"
                        className="p-1.5 rounded text-[var(--muted)] hover:text-red-600 hover:bg-red-50 transition disabled:opacity-40"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Invite Dialog */}
      {showInviteDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4">
          <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-white p-6 shadow-lg space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-[var(--foreground)]">Person einladen</h3>
              <button
                onClick={() => { setShowInviteDialog(false); resetInviteForm(); }}
                className="text-[var(--muted)] hover:text-[var(--foreground)] transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Mode toggle */}
            <div className="flex rounded-[var(--radius-md)] border border-[var(--border)] overflow-hidden text-sm">
              {(["existing", "new"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setInviteMode(m)}
                  className={`flex-1 py-2 font-medium transition ${
                    inviteMode === m
                      ? "bg-[var(--primary)] text-white"
                      : "bg-white text-[var(--text-2)] hover:bg-[var(--surface-2)]"
                  }`}
                >
                  {m === "existing" ? "Bestehende Person" : "Neue Person"}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              {inviteMode === "existing" ? (
                <div className="space-y-1">
                  <label className="text-sm font-medium text-[var(--foreground)]">Person-ID</label>
                  <input
                    type="text"
                    placeholder="clxxxxxxxx..."
                    value={invitePersonId}
                    onChange={(e) => setInvitePersonId(e.target.value)}
                    className="w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                  />
                  <p className="text-xs text-[var(--muted)]">
                    Die ID findest du in der Personenübersicht.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-[var(--foreground)]">Vorname</label>
                    <input
                      type="text"
                      value={inviteFirstName}
                      onChange={(e) => setInviteFirstName(e.target.value)}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-[var(--foreground)]">Nachname</label>
                    <input
                      type="text"
                      value={inviteLastName}
                      onChange={(e) => setInviteLastName(e.target.value)}
                      className="w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                    />
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <label className="text-sm font-medium text-[var(--foreground)]">E-Mail-Adresse</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="w-full rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--primary)]"
                />
              </div>
            </div>

            {inviteError && (
              <p className="rounded-[var(--radius-md)] border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                {inviteError}
              </p>
            )}

            <div className="flex justify-end gap-2">
              <button
                onClick={() => { setShowInviteDialog(false); resetInviteForm(); }}
                className="rounded-[var(--radius-md)] border border-[var(--border)] px-3 py-2 text-sm font-medium text-[var(--foreground)] hover:bg-[var(--surface-2)] transition"
              >
                Abbrechen
              </button>
              <button
                onClick={handleInvite}
                disabled={isInviting}
                className="rounded-[var(--radius-md)] bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 transition disabled:opacity-60"
              >
                {isInviting ? "Wird gesendet…" : "Einladung senden"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
