/**
 * CmsLegend
 *
 * Renders the status legend for the CMS hub overview,
 * explaining what "Available", "Foundation", "Coming Next" and "Roadmap" mean.
 * Server component — purely presentational.
 */

import { CMS_STATUS_LABEL, CMS_STATUS_DOT_CLASS } from "@/lib/cms/types";
import type { CmsFeatureStatus } from "@/lib/cms/types";

const LEGEND_ITEMS: { status: CmsFeatureStatus; description: string }[] = [
  { status: "available", description: "Voll funktionsfähig" },
  { status: "foundation", description: "Datenmodell & Workflow vorhanden" },
  { status: "coming_next", description: "Nächster Roadmap-Slice" },
  { status: "future", description: "Langfristige Roadmap" },
];

export function CmsLegend() {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
        Status-Legende
      </p>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {LEGEND_ITEMS.map(({ status, description }) => (
          <div key={status} className="flex items-center gap-2">
            <span
              className={`h-2 w-2 rounded-full shrink-0 ${CMS_STATUS_DOT_CLASS[status]}`}
            />
            <span className="text-xs text-[var(--text-2)]">
              <span className="font-medium">{CMS_STATUS_LABEL[status]}</span>
              {" — "}
              {description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
