"use client";

import { useCallback, useEffect, useState } from "react";
import {
  FONT_SIZE_LABELS,
  INFOBOARD_FONT_SIZES,
  type InfoboardFontSize,
} from "@/lib/infoboard/screen1-logo-settings";
import {
  isEmptyCardOverride,
  serializeScreen1StudioConfig,
  type Screen1CardOverride,
  type Screen1StudioConfig,
} from "@/lib/infoboard/screen1-studio-types";

export type Screen1StudioCardRef = {
  readonly key: string;
  readonly label: string;
  readonly kind: "training-group" | "event";
};

type SizeControlProps = {
  label: string;
  value: InfoboardFontSize | null | undefined;
  onChange: (value: InfoboardFontSize | null) => void;
  testId?: string;
};

function SizeControl({ label, value, onChange, testId }: SizeControlProps) {
  return (
    <fieldset className="space-y-1.5" data-testid={testId}>
      <legend className="text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </legend>
      <div className="flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => onChange(null)}
          className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
            value == null
              ? "border-[var(--sce-primary)] bg-[var(--sce-primary)]/10 text-[var(--sce-primary)]"
              : "border-[var(--border)] text-[var(--muted)] hover:bg-[var(--surface-2)]"
          }`}
        >
          Standard
        </button>
        {INFOBOARD_FONT_SIZES.map((size) => (
          <button
            key={size}
            type="button"
            title={FONT_SIZE_LABELS[size]}
            onClick={() => onChange(size)}
            className={`rounded-md border px-2 py-1 text-[11px] font-semibold ${
              value === size
                ? "border-[var(--sce-primary)] bg-[var(--sce-primary)]/10 text-[var(--sce-primary)]"
                : "border-[var(--border)] text-[var(--foreground)] hover:bg-[var(--surface-2)]"
            }`}
          >
            {size === "SMALL"
              ? "S"
              : size === "MEDIUM"
                ? "M"
                : size === "LARGE"
                  ? "L"
                  : "XL"}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

type Screen1StudioProps = {
  boardId: string;
  initialStudio: Screen1StudioConfig;
  pages: readonly (readonly Screen1StudioCardRef[])[];
  selectedKey: string | null;
  onSelectKey: (key: string | null) => void;
  onStudioChange: (studio: Screen1StudioConfig) => void;
};

export function Screen1Studio({
  boardId,
  initialStudio,
  pages,
  selectedKey,
  onSelectKey,
  onStudioChange,
}: Screen1StudioProps) {
  const [studio, setStudio] = useState<Screen1StudioConfig>(initialStudio);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStudio(initialStudio);
  }, [initialStudio]);

  const selectedOverride = selectedKey != null ? studio.cardOverrides[selectedKey] : undefined;
  const selectedCard =
    selectedKey != null
      ? pages.flat().find((card) => card.key === selectedKey) ?? null
      : null;
  const isTraining = selectedCard?.kind === "training-group";

  const updateOverride = useCallback(
    (key: string, patch: Partial<Screen1CardOverride>) => {
      setStudio((current) => {
        const existing = current.cardOverrides[key] ?? {};
        const merged = { ...existing, ...patch };
        const nextOverrides = { ...current.cardOverrides };
        if (isEmptyCardOverride(merged)) {
          delete nextOverrides[key];
        } else {
          nextOverrides[key] = merged;
        }
        const next = { cardOverrides: nextOverrides };
        onStudioChange(next);
        return next;
      });
      setSaved(false);
    },
    [onStudioChange],
  );

  const resetOverride = useCallback(
    (key: string) => {
      setStudio((current) => {
        const nextOverrides = { ...current.cardOverrides };
        delete nextOverrides[key];
        const next = { cardOverrides: nextOverrides };
        onStudioChange(next);
        return next;
      });
      setSaved(false);
    },
    [onStudioChange],
  );

  async function saveStudio() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/infoboards/${boardId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          screen1StudioJson: serializeScreen1StudioConfig(studio),
        }),
      });
      if (!response.ok) {
        const data = (await response.json()) as { error?: string };
        throw new Error(data.error ?? "Speichern fehlgeschlagen.");
      }
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <aside
      className="flex h-full min-h-[320px] flex-col rounded-xl border border-[var(--border)] bg-[var(--surface)]"
      data-testid="screen1-studio"
    >
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-sm font-semibold text-[var(--foreground)]">
          Screen-1 Studio
        </h2>
        <p className="mt-0.5 text-xs text-[var(--muted)]">
          Kartensteuerung und Seitenzusammensetzung
        </p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto px-4 py-3">
        {pages.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">Keine aktiven Karten.</p>
        ) : (
          pages.map((pageCards, pageIndex) => (
            <section key={`studio-page-${pageIndex}`} data-testid={`studio-page-${pageIndex}`}>
              <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-[var(--muted)]">
                Seite {pageIndex + 1}
              </h3>
              <ul className="space-y-1">
                {pageCards.map((card) => (
                  <li key={card.key}>
                    <button
                      type="button"
                      onClick={() => onSelectKey(card.key)}
                      data-testid={`studio-card-${card.key}`}
                      className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        selectedKey === card.key
                          ? "border-[var(--sce-primary)] bg-[var(--sce-primary)]/8 text-[var(--foreground)]"
                          : "border-[var(--border)] bg-[var(--background)] text-[var(--foreground)] hover:bg-[var(--surface-2)]"
                      }`}
                    >
                      <span className="font-medium">{card.label}</span>
                      {studio.cardOverrides[card.key] != null && (
                        <span className="ml-2 text-[10px] font-semibold uppercase text-[var(--sce-primary)]">
                          Angepasst
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))
        )}

        {selectedKey != null && selectedCard != null && (
          <section
            className="space-y-3 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3"
            data-testid="studio-card-controls"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                  Ausgewählt
                </p>
                <p className="text-sm font-semibold text-[var(--foreground)]">
                  {selectedCard.label}
                </p>
              </div>
              <button
                type="button"
                onClick={() => resetOverride(selectedKey)}
                className="text-xs font-semibold text-[var(--sce-primary)] hover:underline"
              >
                Zurücksetzen
              </button>
            </div>

            <SizeControl
              label="Team / Event"
              value={selectedOverride?.teamFontSize}
              onChange={(value) =>
                updateOverride(selectedKey, { teamFontSize: value })
              }
              testId="studio-team-font"
            />

            {isTraining && (
              <>
                <SizeControl
                  label="Kabine"
                  value={selectedOverride?.kabineFontSize}
                  onChange={(value) =>
                    updateOverride(selectedKey, { kabineFontSize: value })
                  }
                  testId="studio-kabine-font"
                />
                <SizeControl
                  label="Platz"
                  value={selectedOverride?.platzFontSize}
                  onChange={(value) =>
                    updateOverride(selectedKey, { platzFontSize: value })
                  }
                  testId="studio-platz-font"
                />
              </>
            )}

            <SizeControl
              label="Logo"
              value={selectedOverride?.logoSize}
              onChange={(value) =>
                updateOverride(selectedKey, { logoSize: value })
              }
              testId="studio-logo-size"
            />

            <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] px-3 py-2">
              <input
                type="checkbox"
                checked={selectedOverride?.preferNextPage === true}
                onChange={(event) =>
                  updateOverride(selectedKey, {
                    preferNextPage: event.target.checked ? true : undefined,
                  })
                }
                className="h-4 w-4 accent-[var(--sce-primary)]"
                data-testid="studio-prefer-next-page"
              />
              <span className="text-sm font-medium text-[var(--foreground)]">
                Bevorzugt nächste Seite
              </span>
            </label>
          </section>
        )}
      </div>

      <div className="border-t border-[var(--border)] px-4 py-3">
        {error != null && (
          <p className="mb-2 text-xs text-red-600" role="alert">
            {error}
          </p>
        )}
        <button
          type="button"
          onClick={saveStudio}
          disabled={saving}
          className="w-full rounded-lg bg-[var(--sce-primary)] px-3 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
          data-testid="studio-save"
        >
          {saving ? "Speichern…" : saved ? "Gespeichert" : "Studio speichern"}
        </button>
      </div>
    </aside>
  );
}
