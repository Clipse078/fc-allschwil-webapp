"use client";

import { LayoutTemplate, Sparkles } from "lucide-react";

type Props = {
  onBootstrap?: () => void;
  bootstrapping?: boolean;
};

export function HomepageCanvasEmptyState({ onBootstrap, bootstrapping }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-5 py-20 px-8 text-center">
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: "var(--sce-accent)" }}
      >
        <LayoutTemplate className="h-8 w-8" style={{ color: "var(--sce-primary)" }} />
      </div>

      <div className="space-y-2 max-w-xs">
        <p className="text-base font-semibold text-[var(--foreground)]">
          Canvas ist leer
        </p>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          Erstelle die Standard-Sektionen, um sie im Canvas-Modus visuell zu verwalten.
        </p>
      </div>

      {onBootstrap && (
        <button
          type="button"
          onClick={onBootstrap}
          disabled={bootstrapping}
          className="fca-button-primary"
        >
          <Sparkles className="h-4 w-4" />
          {bootstrapping ? "Wird erstellt…" : "Standard-Sektionen erstellen"}
        </button>
      )}

      <p className="text-[11px] text-[var(--muted)] italic">
        Canvas Mode · Nur-Lese-Vorschau des Seitenaufbaus
      </p>
    </div>
  );
}
