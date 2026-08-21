"use client";

/**
 * REG-WAIT-01K — Shared registration audit timeline for drawer Verlauf tab
 * and inline detail surfaces. Uses existing timeline API + actor resolution.
 */

import { useCallback, useEffect, useState, type ComponentType } from "react";
import {
  Archive,
  CheckCircle2,
  ClipboardList,
  Clock,
  Lightbulb,
  Link2,
  Loader2,
  Mail,
  ShieldAlert,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { formatDateTimeCompact } from "@/lib/tenant-runtime/formatters";
import type { TimelineEntry, TimelineEntryKind } from "@/lib/registrations/timeline";
import { REGISTRATION_DRAWER_TAB_CONTENT_CLASS } from "./RegistrationDrawerTabShell";

const TIMELINE_ICON: Record<TimelineEntryKind, ComponentType<{ className?: string }>> = {
  RECEIVED: Mail,
  STATUS_CHANGE: Clock,
  CONTACTED: CheckCircle2,
  ARCHIVED: Archive,
  ASSIGNED_USER: UserCheck,
  ASSIGNED_TEAM: Users,
  NO_RECOMMENDATION: Lightbulb,
  PERSON_CREATED: UserPlus,
  PERSON_LINKED: Link2,
  PERSON_UNLINKED: Link2,
  DUPLICATE_IGNORED: ShieldAlert,
  WAITING_LIST_ADDED: ClipboardList,
  OTHER: Clock,
};

function TimelineRow({
  entry,
  locale,
  timezone,
  isLast,
}: {
  entry: TimelineEntry;
  locale: string;
  timezone: string;
  isLast: boolean;
}) {
  const Icon = TIMELINE_ICON[entry.kind] ?? Clock;
  return (
    <li className="flex gap-3">
      <div className="flex flex-col items-center">
        <span className="flex h-7 w-7 items-center justify-center rounded-full border border-[var(--border)] bg-[var(--surface-2)]">
          <Icon className="h-3.5 w-3.5 text-[var(--muted)]" aria-hidden />
        </span>
        {!isLast ? <span className="my-1 flex-1 w-px bg-[var(--border)]" aria-hidden /> : null}
      </div>
      <div className="min-w-0 flex-1 pb-4">
        <p className="text-sm font-medium text-[var(--foreground)]">{entry.label}</p>
        {entry.detail ? <p className="mt-0.5 text-xs text-[var(--muted)]">{entry.detail}</p> : null}
        <p className="mt-0.5 text-[0.7rem] text-[var(--muted)]">
          {formatDateTimeCompact(entry.occurredAt, { locale, timezone })}
          {entry.actorName ? ` · ${entry.actorName}` : ""}
        </p>
      </div>
    </li>
  );
}

type Props = {
  registrationId: string;
  tenantSlug: string;
  locale?: string;
  timezone?: string;
  /** Bumps when parent registration mutates so Verlauf stays fresh. */
  refreshKey?: string | null;
  /** When false, skip fetch until the Verlauf tab is opened. */
  enabled?: boolean;
  className?: string;
};

export default function RegistrationTimelinePanel({
  registrationId,
  tenantSlug,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  refreshKey = null,
  enabled = true,
  className,
}: Props) {
  const [timeline, setTimeline] = useState<TimelineEntry[] | null>(null);
  const [timelineLoading, setTimelineLoading] = useState(false);

  const loadTimeline = useCallback(async () => {
    setTimelineLoading(true);
    try {
      const res = await fetch(
        `/api/tenants/${encodeURIComponent(tenantSlug)}/registrations/${encodeURIComponent(registrationId)}/timeline`,
        { cache: "no-store" },
      );
      const payload = await res.json();
      if (res.ok) setTimeline(Array.isArray(payload.timeline) ? payload.timeline : []);
      else setTimeline([]);
    } catch {
      setTimeline([]);
    } finally {
      setTimelineLoading(false);
    }
  }, [registrationId, tenantSlug]);

  useEffect(() => {
    if (!enabled) return;
    setTimeline(null);
    void loadTimeline();
  }, [enabled, loadTimeline, registrationId, refreshKey]);

  return (
    <div className={className ?? REGISTRATION_DRAWER_TAB_CONTENT_CLASS}>
      {timelineLoading && !timeline ? (
        <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Wird geladen…
        </p>
      ) : timeline && timeline.length > 0 ? (
        <ol className="space-y-0">
          {timeline.map((entry, idx) => (
            <TimelineRow
              key={entry.id}
              entry={entry}
              locale={locale}
              timezone={timezone}
              isLast={idx === timeline.length - 1}
            />
          ))}
        </ol>
      ) : (
        <p className="text-sm text-[var(--muted)]">Kein Verlauf vorhanden.</p>
      )}
    </div>
  );
}
