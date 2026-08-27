"use client";

/**
 * TEMPORARY MEDIA-LOGO-01 operational UI.
 * Remove after successful backfill verification before STAGE merge.
 */

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

import {
  MEDIA_LOGO_01G4_FROZEN_CONTRACT,
  type MediaLogoExecuteResult,
  type MediaLogoPreflightResult,
} from "@/lib/assets/media-logo-backfill-operation-contract";

const CONFIRMATION_PHRASE = MEDIA_LOGO_01G4_FROZEN_CONTRACT.confirmationPhrase;

export default function MediaLogoBackfillOperationPanel() {
  const [preflight, setPreflight] = useState<MediaLogoPreflightResult | null>(null);
  const [preflightError, setPreflightError] = useState<string | null>(null);
  const [loadingPreflight, setLoadingPreflight] = useState(true);
  const [confirmation, setConfirmation] = useState("");
  const [executing, setExecuting] = useState(false);
  const [executeResult, setExecuteResult] = useState<MediaLogoExecuteResult | null>(null);
  const [executeError, setExecuteError] = useState<string | null>(null);

  const loadPreflight = useCallback(async () => {
    setLoadingPreflight(true);
    setPreflightError(null);
    try {
      const response = await fetch("/api/ops/media-logo-backfill/preflight", {
        method: "GET",
        cache: "no-store",
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        setPreflight(null);
        setPreflightError(data?.error ?? "Preflight konnte nicht geladen werden.");
        return;
      }
      setPreflight(data as MediaLogoPreflightResult);
    } catch {
      setPreflight(null);
      setPreflightError("Netzwerkfehler beim Laden der Preflight-Daten.");
    } finally {
      setLoadingPreflight(false);
    }
  }, []);

  useEffect(() => {
    void loadPreflight();
  }, [loadPreflight]);

  const phraseMatches = confirmation === CONFIRMATION_PHRASE;
  const canExecute =
    !executing &&
    phraseMatches &&
    preflight?.status === "READY";

  async function handleExecute() {
    if (!canExecute) {
      return;
    }

    setExecuting(true);
    setExecuteError(null);
    setExecuteResult(null);

    try {
      const response = await fetch("/api/ops/media-logo-backfill/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          confirmationPhrase: confirmation,
          expectedEligible: 999,
          expectedFingerprint: "browser-supplied-fingerprint-ignored",
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok && !data?.status) {
        setExecuteError(data?.error ?? "Ausführung fehlgeschlagen.");
        return;
      }
      setExecuteResult(data as MediaLogoExecuteResult);
      await loadPreflight();
    } catch {
      setExecuteError("Netzwerkfehler während der Ausführung.");
    } finally {
      setExecuting(false);
    }
  }

  return (
    <div className="space-y-6 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
      <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
        Temporary operational surface. This will upload canonical transparent PNG assets and
        update ExternalClub.logoUrl for the approved cohort once executed on an authorized
        Vercel Preview deployment.
      </div>

      {loadingPreflight ? (
        <div className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Preflight wird geladen…
        </div>
      ) : null}

      {preflightError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {preflightError}
        </div>
      ) : null}

      {preflight ? (
        <div className="grid gap-4 md:grid-cols-2">
          <InfoRow label="Tenant" value={preflight.display.tenantLabel} />
          <InfoRow label="Status" value={preflight.status} />
          <InfoRow label="Eligible" value={String(preflight.display.eligible)} />
          <InfoRow label="Quality PASS" value={String(preflight.display.qualityPass)} />
          <InfoRow label="Plan fingerprint" value={preflight.display.planFingerprint} />
          <InfoRow label="Manual protected" value={String(preflight.display.manualProtected)} />
          <InfoRow label="Blocked" value={String(preflight.display.blocked)} />
          <InfoRow
            label="Blob capability"
            value={preflight.environment.blobCapability}
          />
          <InfoRow
            label="Runtime"
            value={`${preflight.environment.appEnv} / ${preflight.environment.vercelEnv ?? "n/a"}`}
          />
        </div>
      ) : null}

      {preflight?.status === "BLOCKED" && preflight.contract.reasons.length > 0 ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          <p className="font-medium">Preflight BLOCKED</p>
          <ul className="mt-2 list-disc pl-5">
            {preflight.contract.reasons.map((reason) => (
              <li key={reason}>{reason}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="space-y-3">
        <p className="text-sm text-[var(--muted)]">
          This will upload canonical transparent PNG assets and update ExternalClub.logoUrl
          for the approved cohort.
        </p>
        <label className="block text-sm font-medium" htmlFor="media-logo-confirmation">
          Confirmation phrase
        </label>
        <input
          id="media-logo-confirmation"
          type="text"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
          placeholder={CONFIRMATION_PHRASE}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={() => void handleExecute()}
          disabled={!canExecute}
          className="fca-button-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {executing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Executing…
            </>
          ) : (
            "Execute backfill"
          )}
        </button>
      </div>

      {executeError ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
          {executeError}
        </div>
      ) : null}

      {executeResult ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-4 text-sm">
          <p className="font-medium">Execution result: {executeResult.status}</p>
          {executeResult.execution ? (
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-[var(--muted)]">
              {JSON.stringify(executeResult.execution, null, 2)}
            </pre>
          ) : null}
          {executeResult.postVerification ? (
            <pre className="mt-3 overflow-x-auto whitespace-pre-wrap text-xs text-[var(--muted)]">
              {JSON.stringify(executeResult.postVerification, null, 2)}
            </pre>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm">{value}</div>
    </div>
  );
}
