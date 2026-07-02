"use client";

import { LayoutTemplate, Sparkles, GripVertical, Eye, Pencil } from "lucide-react";

type Props = {
  onBootstrap?: () => void;
  bootstrapping?: boolean;
};

export function HomepageCanvasEmptyState({ onBootstrap, bootstrapping }: Props) {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 px-8 text-center">
      {/* Icon */}
      <div
        className="flex h-16 w-16 items-center justify-center rounded-2xl"
        style={{ background: "var(--sce-accent)" }}
      >
        <LayoutTemplate className="h-8 w-8" style={{ color: "var(--sce-primary)" }} />
      </div>

      {/* Heading + description */}
      <div className="space-y-2 max-w-sm">
        <p className="text-base font-semibold text-[var(--foreground)]">
          Canvas ist leer
        </p>
        <p className="text-sm text-[var(--muted)] leading-relaxed">
          Erstelle die Standard-Sektionen, um die Homepage visuell zu verwalten.
          Du kannst Sektionen danach per Drag &amp; Drop sortieren,
          direkt bearbeiten und gezielt veröffentlichen.
        </p>
      </div>

      {/* CTA */}
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

      {/* Feature hints */}
      <div className="flex flex-wrap justify-center gap-4 text-[11px] text-[var(--muted)]">
        <span className="flex items-center gap-1">
          <GripVertical className="h-3.5 w-3.5 opacity-60" />
          Drag &amp; Drop zum Sortieren
        </span>
        <span className="flex items-center gap-1">
          <Pencil className="h-3.5 w-3.5 opacity-60" />
          Inline-Bearbeitung
        </span>
        <span className="flex items-center gap-1">
          <Eye className="h-3.5 w-3.5 opacity-60" />
          Sichtbarkeit pro Sektion
        </span>
      </div>

      <p className="text-[11px] text-[var(--muted)] italic">
        Canvas Mode · Admin-Ansicht des Seitenaufbaus
      </p>
    </div>
  );
}
