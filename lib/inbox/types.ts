/**
 * Reusable Inbox Framework — Generic Types
 *
 * This module defines the shared data shapes that power all inbox-style
 * experiences in SportClubEvo. Future inboxes (Tasks, Approvals, CRM,
 * Volunteer Requests, Sponsorship Leads) should implement these interfaces
 * so they can reuse the same UI primitives.
 *
 * Nothing here is registration-specific.
 */

import type { ComponentType } from "react";

// ── Core item shape that every inbox item must satisfy ────────────────────────

export type InboxItemBase = {
  id: string;
  status: string;
  /** ISO date string — used for urgency calculation */
  submittedAt: string;
  updatedAt: string;
};

// ── Owner / assignee shape ────────────────────────────────────────────────────

export type InboxOwner = {
  id: string;
  firstName: string;
  lastName: string;
  /** Optional image URL; falls back to initials */
  avatarUrl?: string | null;
};

// ── Classification / routing suggestion ──────────────────────────────────────

export type InboxClassification = {
  /** Short key identifying the routing target */
  targetKey: string;
  /** Human-readable label for the UI */
  targetLabel: string;
  /** Who is responsible for handling this item */
  responsibleRole: string;
  /** One-sentence explanation shown in the drawer */
  reasoning: string;
  /** Controls badge colour — mapped to design token */
  colorToken: string;
};

// ── Status group definition — drives the filter pill row ─────────────────────

export type InboxStatusGroup<TKey extends string = string> = {
  key: TKey;
  label: string;
  statuses: string[];
  /** Tailwind classes for the pill background/text/border */
  pillClass: string;
  /** Tailwind class for the coloured status dot */
  dotClass: string;
};

// ── Type / category definition — drives the type filter dropdown ──────────────

export type InboxTypeOption = {
  value: string;
  label: string;
  /** Lucide icon component or any SVG icon */
  Icon?: ComponentType<{ className?: string }>;
};

// ── Urgency ───────────────────────────────────────────────────────────────────

export type UrgencyLevel = "ok" | "warn" | "alert";

export type UrgencyInfo = {
  level: UrgencyLevel;
  /** Localised display label, e.g. "Heute", "Gestern", "Vor 3 Tagen" */
  label: string;
};

// ── Computed relative-time helper (locale: de) ────────────────────────────────

export function getUrgencyInfo(isoDate: string): UrgencyInfo {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return { level: "ok", label: "Heute" };
  if (diffDays === 1) return { level: "ok", label: "Gestern" };
  if (diffDays === 2) return { level: "warn", label: "Vor 2 Tagen" };
  if (diffDays < 7) return { level: "warn", label: `Vor ${diffDays} Tagen` };
  if (diffDays === 7) return { level: "alert", label: "Vor 7 Tagen" };
  if (diffDays < 14) return { level: "alert", label: `Vor ${diffDays} Tagen` };
  if (diffDays === 14) return { level: "alert", label: "Vor 14 Tagen" };
  return { level: "alert", label: `Vor ${diffDays} Tagen` };
}

// ── Avatar helpers ────────────────────────────────────────────────────────────

export function getInitials(firstName: string, lastName: string): string {
  return `${firstName.charAt(0)}${lastName.charAt(0)}`.toUpperCase();
}
