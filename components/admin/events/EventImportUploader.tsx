"use client";

import { useMemo, useState } from "react";

type PreviewRow = {
  rowNumber: number;
  title: string;
  type: string;
  teamName: string | null;
  matchedTeamName: string | null;
  matchedTeamId: string | null;
  opponentName: string | null;
  organizerName: string | null;
  competitionLabel: string | null;
  homeAway: string | null;
  location: string | null;
  startAt: string;
  endAt: string | null;
  hasTeamWarning: boolean;
};

type CsvMeta = {
  delimiter: string;
  headers: string[];
  mapping: Record<string, string | null>;
};

type PreviewPayload = {
  activeSeason: {
    id: string;
    key: string;
    name: string;
  };
  rowsDetected: number;
  warnings: string[];
  rows: PreviewRow[];
  csvMeta: CsvMeta;
};

function formatDateTime(value: string | null) {
  if (!value) {
    return "—";
  }

  return new Date(value).toLocaleString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getTypeLabel(type: string) {
  switch (type) {
    case "MATCH":
      return "Match";
    case "TOURNAMENT":
      return "Turnier";
    case "TRAINING":
      return "Training";
    case "OTHER":
      return "Weiteres Event";
    default:
      return type;
  }
}

function getTypePillClass(type: string) {
  switch (type) {
    case "MATCH":
      return "border-red-200 bg-red-50 text-red-700";
    case "TOURNAMENT":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "TRAINING":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "OTHER":
      return "border-slate-200 bg-slate-50 text-slate-700";
    default:
      return "border-slate-200 bg-slate-50 text-slate-700";
  }
}

function getMappingRows(mapping: Record<string, string | null>) {
  return Object.entries(mapping);
}

export default function EventImportUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewPayload | null>(null);

  const hasBlockingWarnings = useMemo(() => {
    return !!preview?.rows.some((row) => row.hasTeamWarning);
  }, [preview]);

  const rowsWithoutEndAt = useMemo(() => {
    return preview?.rows.filter((row) => !row.endAt).length ?? 0;
  }, [preview]);

  async function loadPreview(selectedFile: File) {
    setPreviewLoading(true);
    setImportLoading(false);
    setError(null);
    setMessage(null);
    setPreview(null);

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);

      const res = await fetch("/api/events/import/preview", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? "Vorschau konnte nicht geladen werden.");
      }

      setPreview(data as PreviewPayload);
      setMessage("Vorschau erfolgreich geladen.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Vorschau konnte nicht geladen werden.");
    } finally {
      setPreviewLoading(false);
    }
  }

  async function handleFileChange(nextFile: File | null) {
    setFile(nextFile);
    setMessage(null);
    setError(null);
    setPreview(null);

    if (!nextFile) {
      return;
    }

    await loadPreview(nextFile);
  }

  async function handlePreviewReload() {
    if (!file) {
      setError("Bitte zuerst eine CSV-Datei auswählen.");
      setMessage(null);
      setPreview(null);
      return;
    }

    await loadPreview(file);
  }

  async function handleImport() {
    if (!file) {
      setError("Bitte zuerst eine CSV-Datei auswählen.");
      setMessage(null);
      return;
    }

    if (!preview) {
      setError("Bitte zuerst eine Vorschau laden.");
      setMessage(null);
      return;
    }

    if (hasBlockingWarnings) {
      setError("Import blockiert: Bitte zuerst die Team-Zuordnungswarnungen in der CSV korrigieren.");
      setMessage(null);
      return;
    }

    setImportLoading(true);
    setError(null);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/events/import", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.error ?? "Import fehlgeschlagen.");
      }

      setMessage(
        data?.message
          ? data.created
            ? data.message + " (" + data.created + " Events erstellt)"
            : data.message
          : "Import erfolgreich abgeschlossen."
      );

      setTimeout(() => {
        window.location.reload();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import fehlgeschlagen.");
    } finally {
      setImportLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="fca-eyebrow">Events Import</p>
            <h3 className="fca-heading mt-2">CSV Vorschau und Import</h3>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600">
              Smart Mapping erkennt jetzt automatisch verschiedene CSV Header aus
              externen Exporten und ordnet sie den passenden Systemfeldern zu.
            </p>
          </div>

          <div className="rounded-[24px] border border-slate-200 bg-slate-50 px-4 py-4">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
              Unterstützte Varianten
            </p>
            <p className="mt-2 max-w-xl text-sm leading-6 text-slate-600">
              z. B. team / mannschaft, opponentName / gegner / gastteam,
              startAt / datum / beginn / anpfiff, location / ort / sportplatz
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[1fr_auto] xl:items-end">
          <div className="space-y-2">
            <label className="fca-label">CSV Datei</label>
            <input
              type="file"
              accept=".csv"
              className="fca-input"
              onChange={(e) => void handleFileChange(e.target.files?.[0] || null)}
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => void handlePreviewReload()}
              disabled={previewLoading || importLoading || !file}
              className="fca-button-secondary"
            >
              {previewLoading ? "Lade Vorschau..." : "Vorschau neu laden"}
            </button>

            <button
              type="button"
              onClick={() => void handleImport()}
              disabled={previewLoading || importLoading || !preview || hasBlockingWarnings}
              className="fca-button-primary"
            >
              {importLoading ? "Importiere..." : "Import definitiv ausführen"}
            </button>
          </div>
        </div>

        {message ? (
          <div className="fca-status-box fca-status-box-success mt-4">{message}</div>
        ) : null}

        {error ? (
          <div className="fca-status-box fca-status-box-error mt-4">{error}</div>
        ) : null}
      </div>

      {preview ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Aktive Saison
              </p>
              <p className="mt-3 font-[var(--font-display)] text-[1.3rem] font-bold uppercase leading-[0.95] tracking-[-0.02em] text-slate-900">
                {preview.activeSeason.name}
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Erkannte Zeilen
              </p>
              <p className="mt-3 font-[var(--font-display)] text-[1.3rem] font-bold uppercase leading-[0.95] tracking-[-0.02em] text-slate-900">
                {preview.rowsDetected}
              </p>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.18em] text-slate-500">
                Zeilen ohne Endzeit
              </p>
              <p className="mt-3 font-[var(--font-display)] text-[1.3rem] font-bold uppercase leading-[0.95] tracking-[-0.02em] text-slate-900">
                {rowsWithoutEndAt}
              </p>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div>
                <p className="fca-eyebrow">Smart Mapping</p>
                <h4 className="fca-subheading mt-2">Erkannte CSV Feldzuordnung</h4>
              </div>

              <span className="fca-pill">
                Delimiter: {preview.csvMeta.delimiter === ";" ? "Semikolon" : "Komma"}
              </span>
            </div>

            <div className="mt-5 overflow-hidden rounded-[24px] border border-slate-200">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-[0.72rem] uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-3">Systemfeld</th>
                    <th className="px-4 py-3">Erkannte CSV Spalte</th>
                  </tr>
                </thead>
                <tbody>
                  {getMappingRows(preview.csvMeta.mapping).map(([fieldKey, mappedHeader]) => (
                    <tr key={fieldKey} className="border-b border-slate-100 bg-white last:border-b-0">
                      <td className="px-4 py-3 text-sm font-semibold text-slate-900">
                        {fieldKey}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {mappedHeader ?? "Nicht gefunden"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {preview.warnings.length > 0 ? (
            <div className="fca-status-box fca-status-box-warn">
              <p className="font-semibold">Warnungen</p>
              <div className="mt-2 space-y-1 text-sm">
                {preview.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          ) : (
            <div className="fca-status-box fca-status-box-success">
              Keine Team-Zuordnungswarnungen gefunden.
            </div>
          )}

          <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-sm">
            <div className="border-b border-slate-200 bg-slate-50 px-5 py-4">
              <p className="text-sm font-semibold text-slate-900">
                Import Vorschau
              </p>
              <p className="mt-1 text-sm text-slate-600">
                Die Vorschau zeigt die bereits normalisierten Eventdaten nach Smart Mapping.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-[0.72rem] uppercase tracking-[0.18em] text-slate-500">
                    <th className="px-4 py-3">Zeile</th>
                    <th className="px-4 py-3">Titel</th>
                    <th className="px-4 py-3">Typ</th>
                    <th className="px-4 py-3">Team</th>
                    <th className="px-4 py-3">Gegner / Organisator</th>
                    <th className="px-4 py-3">Start</th>
                    <th className="px-4 py-3">Ende</th>
                    <th className="px-4 py-3">Ort</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.rows.map((row) => (
                    <tr
                      key={row.rowNumber}
                      className={
                        row.hasTeamWarning
                          ? "border-b border-amber-100 bg-amber-50/60 last:border-b-0"
                          : !row.endAt
                            ? "border-b border-blue-100 bg-blue-50/40 last:border-b-0"
                            : "border-b border-slate-100 bg-white last:border-b-0"
                      }
                    >
                      <td className="px-4 py-3 text-sm text-slate-600">{row.rowNumber}</td>

                      <td className="px-4 py-3">
                        <div className="text-sm font-semibold text-slate-900">{row.title}</div>
                        {row.competitionLabel ? (
                          <div className="mt-1 text-xs text-slate-500">{row.competitionLabel}</div>
                        ) : null}
                      </td>

                      <td className="px-4 py-3">
                        <span className={"inline-flex rounded-full border px-3 py-1 text-xs font-semibold " + getTypePillClass(row.type)}>
                          {getTypeLabel(row.type)}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-700">
                        <div>{row.teamName ?? "-"}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {row.hasTeamWarning
                            ? "Nicht in aktiver Saison gefunden"
                            : row.matchedTeamName ?? "Ohne Team"}
                        </div>
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-700">
                        {row.opponentName ?? row.organizerName ?? "-"}
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-700">
                        {formatDateTime(row.startAt)}
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-700">
                        {row.endAt ? (
                          formatDateTime(row.endAt)
                        ) : (
                          <span className="text-blue-700">Keine Endzeit</span>
                        )}
                      </td>

                      <td className="px-4 py-3 text-sm text-slate-700">{row.location ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}