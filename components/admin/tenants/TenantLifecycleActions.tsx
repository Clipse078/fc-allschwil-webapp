"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PauseCircle, RotateCcw, Archive, Loader2 } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import type { TenantLifecycleStatus } from "@/lib/tenants/platform-ops/types";

type TenantLifecycleActionsProps = {
  tenantKey: string;
  tenantName: string;
  status: TenantLifecycleStatus;
  canManage: boolean;
};

type PendingAction = "suspend" | "reactivate" | "activate" | "archive" | null;

const ACTION_COPY: Record<
  Exclude<PendingAction, null>,
  { title: string; description: string; confirmLabel: string; requiresReason: boolean; variant: "danger" | "primary" }
> = {
  suspend: {
    title: "Tenant suspendieren",
    description:
      "Ordentliche Tenant-Benutzer verlieren den operativen Zugriff. Platform-Superadmins können den Tenant weiter verwalten.",
    confirmLabel: "Suspendieren",
    requiresReason: true,
    variant: "danger",
  },
  reactivate: {
    title: "Tenant reaktivieren",
    description: "Der Tenant wird wieder aktiv und ordentliche Benutzer erhalten wieder Zugriff.",
    confirmLabel: "Reaktivieren",
    requiresReason: false,
    variant: "primary",
  },
  activate: {
    title: "Tenant aktivieren",
    description: "Der Tenant wird in den aktiven Betriebszustand versetzt.",
    confirmLabel: "Aktivieren",
    requiresReason: false,
    variant: "primary",
  },
  archive: {
    title: "Tenant archivieren",
    description:
      "Archivierte Tenants sind schreibgeschützt und aus der Standardliste ausgeblendet. Daten bleiben erhalten.",
    confirmLabel: "Archivieren",
    requiresReason: true,
    variant: "danger",
  },
};

export default function TenantLifecycleActions({
  tenantKey,
  tenantName,
  status,
  canManage,
}: TenantLifecycleActionsProps) {
  const router = useRouter();
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  if (!canManage) return null;

  const availableActions: Array<{
    action: Exclude<PendingAction, null>;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    tone: "default" | "danger";
  }> = [];

  if (status === "ACTIVE") {
    availableActions.push(
      { action: "suspend", label: "Suspendieren", icon: PauseCircle, tone: "danger" },
      { action: "archive", label: "Archivieren", icon: Archive, tone: "danger" },
    );
  } else if (status === "INACTIVE") {
    availableActions.push(
      { action: "reactivate", label: "Reaktivieren", icon: RotateCcw, tone: "default" },
      { action: "archive", label: "Archivieren", icon: Archive, tone: "danger" },
    );
  }

  async function handleConfirm() {
    if (!pendingAction) return;
    const copy = ACTION_COPY[pendingAction];
    if (copy.requiresReason && !reason.trim()) {
      setError("Bitte einen Grund angeben.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/tenants/${tenantKey}/lifecycle`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: pendingAction,
            reason: reason.trim() || undefined,
          }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError(data?.error ?? "Lifecycle-Aktion fehlgeschlagen.");
          return;
        }
        setPendingAction(null);
        setReason("");
        router.refresh();
      } catch {
        setError("Netzwerkfehler. Bitte erneut versuchen.");
      }
    });
  }

  if (availableActions.length === 0) {
    return (
      <p className="text-sm text-[var(--muted)]">
        Archivierte Tenants können nur noch eingesehen oder dauerhaft gelöscht werden.
      </p>
    );
  }

  const dialogCopy = pendingAction ? ACTION_COPY[pendingAction] : null;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {availableActions.map(({ action, label, icon: Icon, tone }) => (
          <button
            key={action}
            type="button"
            onClick={() => {
              setPendingAction(action);
              setReason("");
              setError(null);
            }}
            disabled={isPending}
            className={
              tone === "danger"
                ? "inline-flex items-center gap-2 rounded-[var(--radius-md)] border border-[var(--sce-danger-border)] bg-[var(--sce-danger-light)] px-3 py-2 text-sm font-medium text-[var(--sce-danger)] transition hover:opacity-90 disabled:opacity-50"
                : "fca-button-secondary"
            }
          >
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {error && !pendingAction && (
        <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {dialogCopy && (
        <Dialog
          open={Boolean(pendingAction)}
          onClose={() => {
            if (!isPending) {
              setPendingAction(null);
              setReason("");
              setError(null);
            }
          }}
          title={dialogCopy.title}
          description={`${tenantName} (${tenantKey})`}
          footer={
            <div className="flex justify-end gap-2">
              <Button
                variant="secondary"
                onClick={() => {
                  setPendingAction(null);
                  setReason("");
                  setError(null);
                }}
                disabled={isPending}
              >
                Abbrechen
              </Button>
              <Button
                variant={dialogCopy.variant}
                onClick={handleConfirm}
                disabled={isPending}
              >
                {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {dialogCopy.confirmLabel}
              </Button>
            </div>
          }
        >
          <div className="space-y-4">
            <p className="text-sm text-[var(--text-2)]">{dialogCopy.description}</p>
            {dialogCopy.requiresReason && (
              <div>
                <label
                  htmlFor="lifecycle-reason"
                  className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]"
                >
                  Grund *
                </label>
                <textarea
                  id="lifecycle-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="fca-input min-h-[88px] resize-y"
                  placeholder="Kurze Begründung für Audit und Operations…"
                />
              </div>
            )}
            {error && (
              <div className="rounded-[var(--radius-xl)] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            )}
          </div>
        </Dialog>
      )}
    </div>
  );
}
