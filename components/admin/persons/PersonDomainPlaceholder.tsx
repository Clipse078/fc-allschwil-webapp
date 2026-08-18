"use client";

/**
 * PERSON-UX-01 — Reusable architectural placeholder for deferred Person
 * information domains.
 *
 * Used for Mitgliedschaft, Finanzen, Gesundheit, and Dokumente tabs until
 * their dedicated slices are implemented.
 *
 * Each placeholder:
 * - Makes the architectural boundary visible to users and developers
 * - Documents the access/permission requirements where they differ from people.view
 * - Never shows fake or invented data
 */

import React from "react";

type PlaceholderVariant = "default" | "restricted";

type PersonDomainPlaceholderProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  plannedFor?: string;
  /** "restricted" adds a prominent access-control notice */
  variant?: PlaceholderVariant;
  accessNote?: string;
};

export default function PersonDomainPlaceholder({
  icon,
  title,
  description,
  plannedFor,
  variant = "default",
  accessNote,
}: PersonDomainPlaceholderProps) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-10 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--surface-2)] text-[var(--muted)]">
          {icon}
        </div>
        <div className="max-w-sm">
          <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-[var(--muted)]">{description}</p>
          {plannedFor ? (
            <p className="mt-3 text-[10px] font-medium uppercase tracking-wider text-[var(--muted)]">
              Geplant für {plannedFor}
            </p>
          ) : null}
        </div>
      </div>

      {variant === "restricted" && accessNote ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="mt-0.5 h-4 w-4 shrink-0 text-amber-600">
            <svg viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
              <path d="M8 1a7 7 0 1 0 0 14A7 7 0 0 0 8 1zM7.25 4.5a.75.75 0 0 1 1.5 0v4a.75.75 0 0 1-1.5 0v-4zm.75 8a.875.875 0 1 1 0-1.75.875.875 0 0 1 0 1.75z" />
            </svg>
          </div>
          <p className="text-xs text-amber-800 leading-relaxed">{accessNote}</p>
        </div>
      ) : null}
    </div>
  );
}
