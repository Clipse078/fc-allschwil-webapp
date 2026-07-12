"use client";

/**
 * SfvConnectionPanel
 *
 * Client component: renders the SFV connection test button and displays results.
 *
 * Calls POST /api/admin/integrations/sfv/test server-side only.
 * The token is never returned to this component — only sanitized status fields.
 * The component holds test results in React state; nothing is persisted.
 */

import { useState } from "react";
import { Button } from "@/components/ui/Button";

type ConnectionTestResult = {
  connected: boolean;
  configurationValid: boolean;
  environment?: string;
  clubIdConfigured?: boolean;
  tokenValid?: boolean;
  tokenExpiresAt?: string | null;
  testedAt?: string;
  error?: { code: string; message: string } | null;
  missingVariables?: string[];
  invalidVariables?: string[];
};

type SfvConnectionPanelProps = {
  configurationValid: boolean;
};

export default function SfvConnectionPanel({ configurationValid }: SfvConnectionPanelProps) {
  const [result, setResult] = useState<ConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  async function runTest() {
    setTesting(true);
    setFetchError(null);
    setResult(null);

    try {
      const response = await fetch("/api/admin/integrations/sfv/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      const data: ConnectionTestResult = await response.json();
      setResult(data);
    } catch {
      setFetchError("Verbindungstest konnte nicht gesendet werden. Bitte Seite neu laden.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Button
          variant="primary"
          onClick={runTest}
          loading={testing}
          disabled={!configurationValid}
        >
          {testing ? "Teste…" : "Verbindung testen"}
        </Button>

        {!configurationValid && (
          <p className="text-xs text-[var(--text-2)]">
            Konfiguration unvollständig — alle vier SFV-Variablen müssen gesetzt sein.
          </p>
        )}
      </div>

      {fetchError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-700">{fetchError}</p>
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="rounded-lg border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center gap-3">
              {result.connected ? (
                <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">
                  Verbunden
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-red-700">
                  Nicht verbunden
                </span>
              )}

              {result.testedAt && (
                <span className="text-xs text-[var(--muted)]">
                  Getestet: {new Date(result.testedAt).toLocaleString("de-CH")}
                </span>
              )}
            </div>

            <dl className="space-y-2 text-sm">
              {result.environment && (
                <div className="flex justify-between border-b border-[var(--border)] pb-2">
                  <dt className="font-medium text-[var(--text-2)]">SFV-Umgebung</dt>
                  <dd className="font-semibold text-[var(--foreground)] uppercase">
                    {result.environment}
                  </dd>
                </div>
              )}

              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <dt className="font-medium text-[var(--text-2)]">Club-ID konfiguriert</dt>
                <dd className="text-[var(--foreground)]">
                  {result.clubIdConfigured ? "Ja" : "Nein"}
                </dd>
              </div>

              <div className="flex justify-between border-b border-[var(--border)] pb-2">
                <dt className="font-medium text-[var(--text-2)]">Token gültig</dt>
                <dd className="text-[var(--foreground)]">{result.tokenValid ? "Ja" : "Nein"}</dd>
              </div>

              <div className="flex justify-between">
                <dt className="font-medium text-[var(--text-2)]">Token läuft ab</dt>
                <dd className="text-[var(--foreground)]">
                  {result.tokenExpiresAt
                    ? new Date(result.tokenExpiresAt).toLocaleString("de-CH")
                    : "Unbekannt / kein Ablauf konfiguriert"}
                </dd>
              </div>
            </dl>

            {result.error && (
              <div className="mt-3 rounded border border-red-200 bg-red-50 p-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700">
                  {result.error.code}
                </p>
                <p className="mt-1 text-sm text-red-700">{result.error.message}</p>
              </div>
            )}

            {result.missingVariables && result.missingVariables.length > 0 && (
              <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-semibold text-amber-700">
                  Fehlende Umgebungsvariablen:
                </p>
                <ul className="mt-1 list-disc pl-4 text-xs text-amber-700">
                  {result.missingVariables.map((v) => (
                    <li key={v}>{v}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
