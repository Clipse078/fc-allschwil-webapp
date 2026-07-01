"use client";

/**
 * WebsitePreviewEmptyState
 *
 * Shown inside the preview frame when no sections are available
 * for the current preview mode.
 */

import { Blocks } from "lucide-react";
import type { PreviewMode } from "./WebsitePreviewModeSwitch";

type Props = {
  mode: PreviewMode;
};

export default function WebsitePreviewEmptyState({ mode }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-20 px-6 text-center text-[var(--muted)]">
      <Blocks className="h-10 w-10 mb-3 opacity-30" />
      {mode === "published" ? (
        <>
          <p className="text-sm font-medium text-[var(--text-2)]">
            Keine veröffentlichten Sektionen
          </p>
          <p className="mt-1.5 text-xs max-w-xs leading-relaxed">
            Wechsle zu{" "}
            <span className="font-medium text-amber-600">Draft</span> um alle
            Sektionen inkl. Entwürfe zu sehen, oder veröffentliche zuerst
            Sektionen im Builder.
          </p>
        </>
      ) : (
        <>
          <p className="text-sm font-medium text-[var(--text-2)]">
            Keine Sektionen vorhanden
          </p>
          <p className="mt-1.5 text-xs">
            Füge Sektionen im Builder hinzu.
          </p>
        </>
      )}
    </div>
  );
}
