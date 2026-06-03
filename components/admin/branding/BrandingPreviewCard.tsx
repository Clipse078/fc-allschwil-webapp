/**
 * BrandingPreviewCard — Slice 10.9
 *
 * Displays a visual preview of the tenant's configured branding:
 *   • Logo (via TenantLogo — falls back to platform icon)
 *   • Tenant name
 *   • Primary + secondary color swatches
 *   • Sample button (primary color)
 *   • Sample badge (secondary color)
 *   • Branding health status (via getBrandingHealth)
 *
 * ─── Principles ──────────────────────────────────────────────────────────────
 *
 * - Reads only raw nullable branding fields; resolves via resolveTenantBranding().
 * - All logo rendering delegated to TenantLogo (no inline logo logic here).
 * - All validation delegated to branding-validation.ts (no inline validators).
 * - No duplicate branding logic.
 * - Pure presentational component — no data fetching, no mutations.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────────
 *
 *   <BrandingPreviewCard
 *     tenantName={tenant.name}
 *     logoUrl={tenant.logoUrl}
 *     primaryColor={tenant.primaryColor}
 *     secondaryColor={tenant.secondaryColor}
 *   />
 */

"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { resolveTenantBranding } from "@/lib/tenant-runtime/branding";
import { getBrandingHealth } from "@/lib/tenant-runtime/branding-validation";
import TenantLogo from "./TenantLogo";

type BrandingPreviewCardProps = {
  tenantName: string;
  logoUrl: string | null | undefined;
  primaryColor: string | null | undefined;
  secondaryColor: string | null | undefined;
};

export default function BrandingPreviewCard({
  tenantName,
  logoUrl,
  primaryColor,
  secondaryColor,
}: BrandingPreviewCardProps) {
  const resolved = resolveTenantBranding({ logoUrl: logoUrl ?? null, primaryColor: primaryColor ?? null, secondaryColor: secondaryColor ?? null });
  const health = getBrandingHealth({ logoUrl, primaryColor, secondaryColor });

  return (
    <div className="sce-detail-section">
      <div className="sce-detail-section-header">
        <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
          Branding-Vorschau
        </p>
      </div>
      <div className="sce-detail-section-body space-y-6">

        {/* Preview canvas */}
        <div
          className="rounded-[var(--radius-xl)] border border-[var(--border)] p-5 space-y-4"
          style={{ background: "var(--surface-2)" }}
        >
          {/* Logo + tenant name row */}
          <div className="flex items-center gap-3">
            <TenantLogo logoUrl={logoUrl} size={40} alt={`${tenantName} logo`} />
            <div>
              <p className="text-[0.68rem] font-semibold uppercase tracking-[0.12em] text-[var(--muted)]">
                SportClubEvo
              </p>
              <p
                className="text-[0.95rem] font-bold leading-tight tracking-tight"
                style={{ color: resolved.primaryColor }}
              >
                {tenantName}
              </p>
            </div>
          </div>

          {/* Color swatches */}
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-6 w-6 rounded-full border border-[var(--border)]"
                style={{ background: resolved.primaryColor }}
                title={`Primary: ${resolved.primaryColor}`}
              />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Primärfarbe</p>
                <p className="font-mono text-xs text-[var(--foreground)]">{resolved.primaryColor}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span
                className="inline-block h-6 w-6 rounded-full border border-[var(--border)]"
                style={{ background: resolved.secondaryColor }}
                title={`Secondary: ${resolved.secondaryColor}`}
              />
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--muted)]">Sekundärfarbe</p>
                <p className="font-mono text-xs text-[var(--foreground)]">{resolved.secondaryColor}</p>
              </div>
            </div>
          </div>

          {/* Sample button + badge */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              className="rounded-[var(--radius)] px-4 py-1.5 text-sm font-semibold text-white"
              style={{ background: resolved.primaryColor }}
              tabIndex={-1}
              aria-hidden="true"
            >
              Beispiel-Button
            </button>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[0.72rem] font-semibold text-white"
              style={{ background: resolved.secondaryColor }}
              aria-hidden="true"
            >
              Beispiel-Badge
            </span>
          </div>
        </div>

        {/* Health status */}
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
            Branding-Status
          </p>
          <ul className="space-y-1.5">
            {health.items.map((item) => (
              <li key={item.label} className="flex items-start gap-2">
                {item.ok ? (
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                ) : (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
                )}
                <span className="text-[0.8rem] text-[var(--foreground)]">
                  {item.label}
                  {item.detail && (
                    <span className="ml-1 text-[0.72rem] text-[var(--muted)]">
                      — {item.detail}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}
