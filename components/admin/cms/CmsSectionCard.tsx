/**
 * CmsSectionCard
 *
 * Renders a CMS section (e.g. "Inhalte", "Publishing") with its feature list.
 * Each feature shows its availability status and links to the relevant page.
 *
 * Server component — no client state required.
 */

import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";
import type { CmsSection } from "@/lib/cms/types";
import { CmsFeatureStatusBadge } from "./CmsFeatureStatusBadge";

type Props = {
  section: CmsSection;
  /** Keys of features this user can access (based on their permissions). */
  accessibleFeatureKeys?: Set<string>;
};

export function CmsSectionCard({ section, accessibleFeatureKeys }: Props) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="border-b border-[var(--border)] px-5 py-4">
        <h3 className="text-sm font-semibold text-[var(--foreground)]">
          {section.label}
        </h3>
        <p className="mt-0.5 text-xs text-[var(--text-2)]">{section.description}</p>
      </div>

      {/* Feature list */}
      <ul className="divide-y divide-[var(--border)]">
        {section.features.map((feature) => {
          const isAccessible =
            !accessibleFeatureKeys || accessibleFeatureKeys.has(feature.key);
          const isClickable = !!feature.href && isAccessible;

          const Inner = (
            <div className="flex items-start gap-3 px-5 py-3.5">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium text-[var(--foreground)]">
                    {feature.label}
                  </span>
                  <CmsFeatureStatusBadge status={feature.status} />
                  {!isAccessible && (
                    <Lock className="h-3 w-3 text-[var(--muted)] opacity-60" />
                  )}
                </div>
                <p className="mt-0.5 text-xs text-[var(--text-2)]">
                  {feature.description}
                </p>
              </div>
              {isClickable && (
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)] transition-transform group-hover:translate-x-0.5" />
              )}
            </div>
          );

          if (isClickable && feature.href) {
            return (
              <li key={feature.key}>
                <Link
                  href={feature.href}
                  className="group flex w-full items-stretch transition-colors hover:bg-[var(--surface-2)]"
                >
                  {Inner}
                </Link>
              </li>
            );
          }

          return (
            <li
              key={feature.key}
              className={!isAccessible ? "opacity-50" : undefined}
            >
              {Inner}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
