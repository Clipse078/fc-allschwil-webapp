"use client";

import { LayoutTemplate, Sparkles } from "lucide-react";
import { EmptyState } from "@/components/ui/page";

type Props = {
  onBootstrap: () => void;
  bootstrapping: boolean;
};

export function HomepageBuilderEmptyState({ onBootstrap, bootstrapping }: Props) {
  return (
    <EmptyState
      icon={<LayoutTemplate className="h-10 w-10" />}
      heading="Keine Sektionen konfiguriert"
      description="Erstelle die Standard-Sektionen, um mit dem Homepage Builder zu starten."
      action={
        <button
          type="button"
          onClick={onBootstrap}
          disabled={bootstrapping}
          className="fca-button-primary"
        >
          <Sparkles className="h-4 w-4" />
          {bootstrapping ? "Wird erstellt…" : "Standard-Sektionen erstellen"}
        </button>
      }
    />
  );
}
