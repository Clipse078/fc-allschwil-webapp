/**
 * app/(admin)/dashboard/infoboard/page.tsx
 *
 * Infoboard Administration — PP-02E
 *
 * Route: /dashboard/infoboard
 *
 * Architecture:
 *   - Server component (no "use client").
 *   - Uses the authenticated tenant from the session (never from query params).
 *   - Accepts an optional `date` query parameter (YYYY-MM-DD) for admin preview.
 *     Invalid dates fall back to today. The date parameter affects only the
 *     admin preview; the public /infoboard/screen-1 is not modified.
 *   - Calls buildScreen1LivePayload() directly — no HTTP fetch to own API.
 *   - Does not use the legacy /api/public/infoboard feed.
 *   - No preview fixtures are imported or used.
 *
 * Design constraints:
 *   - No public Screen 1 redesign.
 *   - No publication-policy duplication.
 *   - No temporal-logic duplication.
 *   - No schema or migration changes.
 *   - No announcement persistence.
 *   - No Screen 2 implementation.
 *   - Tenant ID never accepted from query parameters.
 *   - Date calculations use Intl.DateTimeFormat with the tenant timezone.
 */

import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Monitor, AlertCircle, Construction } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { InfoboardDisplayCard } from "@/components/infoboard/admin/InfoboardDisplayCard";
import { InfoboardPublicationSummary } from "@/components/infoboard/admin/InfoboardPublicationSummary";
import { InfoboardTodayList } from "@/components/infoboard/admin/InfoboardTodayList";
import { InfoboardDateSelector } from "@/components/infoboard/admin/InfoboardDateSelector";
import {
  buildScreen1LivePayload,
  type Screen1TenantContext,
} from "@/lib/publishing/infoboard/screen1-live-service";
import {
  createCanonicalInfoboardSourceLoader,
  type CanonicalInfoboardPolicyDatabase,
} from "@/lib/publishing/infoboard/canonical-source-loader";
import { buildScreen1AdminSummary } from "@/lib/publishing/infoboard/screen1-admin-summary";
import { toLocalDateKey } from "@/lib/publishing/time/temporal-grouping";

// ── Page props ─────────────────────────────────────────────────────────────────

type InfoboardAdminPageProps = {
  searchParams?: Promise<{
    date?: string;
  }>;
};

// ── Date utilities ────────────────────────────────────────────────────────────

/** Validates a date string against strict YYYY-MM-DD format. */
function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

/**
 * Builds a Date representing approximately noon (12:00) in the given IANA
 * timezone for the given YYYY-MM-DD date key.
 *
 * Uses a two-step Intl approach to avoid server-local timezone dependency:
 *  1. Start with noon UTC on the given date as an estimate.
 *  2. Format in the target timezone to find the local hour.
 *  3. Compute delta from local noon and adjust the estimate.
 *
 * The resulting Date, when passed to toLocalDateKey(..., timezone), will
 * return dateKey. Reference time of 12:00 local ensures the date window
 * covers all reasonable events for that day.
 *
 * @throws {RangeError} When timezone is not a valid IANA identifier.
 */
function buildNoonForDateInTimezone(dateKey: string, timezone: string): Date {
  const [yearStr, monthStr, dayStr] = dateKey.split("-");
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10);
  const day = parseInt(dayStr, 10);

  // Starting estimate: noon UTC on the given date.
  const estimateMs = Date.UTC(year, month - 1, day, 12, 0, 0, 0);
  const estimate = new Date(estimateMs);

  // Format at our estimate in the target timezone to see the local time.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "numeric",
    minute: "numeric",
    hour12: false,
  });

  const parts = formatter.formatToParts(estimate);
  let localHour = 12;
  let localMinute = 0;

  for (const part of parts) {
    if (part.type === "hour") localHour = parseInt(part.value, 10);
    else if (part.type === "minute") localMinute = parseInt(part.value, 10);
  }

  // Delta from current local time to noon local.
  const currentLocalMs = (localHour * 60 + localMinute) * 60_000;
  const targetLocalMs = 12 * 60 * 60_000;
  const deltaMs = targetLocalMs - currentLocalMs;

  return new Date(estimateMs + deltaMs);
}

/**
 * Advances a YYYY-MM-DD date key by one calendar day.
 * Uses the Date constructor without timezone to avoid drift.
 */
function addOneDay(dateKey: string): string {
  const [yr, mo, dy] = dateKey.split("-").map(Number);
  const d = new Date(Date.UTC(yr, mo - 1, dy + 1));
  return d.toISOString().slice(0, 10);
}

// ── Prisma adapter ─────────────────────────────────────────────────────────────

function createPrismaDb(): CanonicalInfoboardPolicyDatabase {
  return {
    event: {
      findMany: (args) =>
        prisma.event.findMany(
          args as Parameters<typeof prisma.event.findMany>[0],
        ) as unknown as ReturnType<CanonicalInfoboardPolicyDatabase["event"]["findMany"]>,
    },
    trainingSession: {
      findMany: (args) =>
        prisma.trainingSession.findMany(
          args as Parameters<typeof prisma.trainingSession.findMany>[0],
        ) as unknown as ReturnType<CanonicalInfoboardPolicyDatabase["trainingSession"]["findMany"]>,
    },
  };
}

// ── Page component ─────────────────────────────────────────────────────────────

export default async function InfoboardAdminPage({
  searchParams,
}: InfoboardAdminPageProps) {
  // ── Authentication ──────────────────────────────────────────────────────────
  // requireAnyPermission redirects unauthenticated users and checks permissions.
  await requireAnyPermission([
    PERMISSIONS.INFOBOARD_MANAGE,
    PERMISSIONS.EVENTS_PUBLISH_INFOBOARD,
  ]);

  // ── Authenticated tenant resolution ─────────────────────────────────────────
  // Tenant comes through the single tenant-context helper (RPERM-04) — never
  // from query parameters, and never from the legacy User.tenantId column.
  const tenantContext = await getActiveTenant();

  if (!tenantContext) {
    notFound();
  }

  if (!tenantContext.timezone) {
    notFound();
  }

  const tenantTimezone = tenantContext.timezone;

  // ── Tenant reference for live service ───────────────────────────────────────
  const tenant: Screen1TenantContext = {
    id: tenantContext.id,
    key: tenantContext.key,
    name: tenantContext.name,
    timezone: tenantTimezone,
    logoUrl: tenantContext.logoUrl,
  };

  // ── Date resolution ─────────────────────────────────────────────────────────
  // Validate the date query parameter. Invalid values safely fall back to today.
  // The date parameter is strictly admin-only and cannot alter public Screen 1.
  const params = (await searchParams) ?? {};
  const rawDate = params.date;
  const today = new Date();
  const todayKey = toLocalDateKey(today, tenantTimezone);
  const tomorrowKey = addOneDay(todayKey);

  let selectedDateKey: string;
  let now: Date;

  if (rawDate && isValidDateKey(rawDate)) {
    selectedDateKey = rawDate;
    now = buildNoonForDateInTimezone(rawDate, tenantTimezone);
  } else {
    selectedDateKey = todayKey;
    now = today;
  }

  const isPreviewDate = selectedDateKey !== todayKey;

  // ── Build Screen 1 live payload ─────────────────────────────────────────────
  // Calls the Screen 1 live service directly — no HTTP fetch to /api/public/*.
  const db = createPrismaDb();
  const loader = createCanonicalInfoboardSourceLoader(db);
  const payload = await buildScreen1LivePayload({ tenant, now, loader });

  // ── Admin summary ───────────────────────────────────────────────────────────
  const summary = buildScreen1AdminSummary(payload.feed);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-8 max-w-[1400px]">
      {/* Header */}
      <AdminSectionHeader
        eyebrow="Spielbetrieb"
        title="Infoboard"
        description="Steuere und überwache die öffentlichen Infoboard-Displays."
        actions={
          <Link
            href="/infoboard/screen-1"
            target="_blank"
            rel="noopener noreferrer"
            className="fca-button-primary inline-flex items-center gap-2"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Display 1 öffnen
          </Link>
        }
      />

      {/* Preview date notice */}
      {isPreviewDate ? (
        <div className="flex items-center gap-3 rounded-[var(--radius-xl)] border border-amber-200 bg-amber-50 px-5 py-3.5">
          <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
          <p className="text-sm text-amber-800">
            Vorschau für{" "}
            <span className="font-semibold font-mono">{selectedDateKey}</span> —
            das öffentliche Display 1 ist davon nicht betroffen.
          </p>
          <Link
            href="/dashboard/infoboard"
            className="ml-auto shrink-0 text-[0.75rem] font-semibold text-amber-700 hover:text-amber-900"
          >
            Zurück zu Heute
          </Link>
        </div>
      ) : null}

      {/* Display cards */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Display 1 */}
        <InfoboardDisplayCard
          label="Display 1"
          title="Tagesübersicht"
          status="active"
          description="Zeigt die heutigen Trainings, Heimspiele und Turniere inklusive Platz- und Garderobenzuteilung."
          publicRoute="/infoboard/screen-1"
          actions={[
            {
              label: "Öffnen",
              href: "/infoboard/screen-1",
              variant: "primary",
            },
            {
              label: "Vorschau",
              href: "/infoboard/preview/screen-1",
              variant: "secondary",
            },
          ]}
        />

        {/* Display 2 */}
        <InfoboardDisplayCard
          label="Display 2"
          title="Sportanlage"
          status="planned"
          description="Zeigt die aktuelle Belegung der Plätze und die Sportanlagenübersicht."
          publicRoute="/infoboard/screen-2"
        />
      </div>

      {/* Publication state section */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div className="flex min-w-0 items-center gap-3">
            <Monitor className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                Aktueller Stand
              </p>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Publikationsstatus
              </p>
            </div>
          </div>
          {/* Date selector: admin-only, affects only this admin preview */}
          <InfoboardDateSelector
            selectedDate={selectedDateKey}
            todayKey={todayKey}
            tomorrowKey={tomorrowKey}
          />
        </div>
        <div className="sce-detail-section-body">
          <InfoboardPublicationSummary
            counts={summary.counts}
            displayDate={summary.displayDate}
          />
        </div>
      </div>

      {/* Today's event list */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div className="flex min-w-0 items-center gap-3">
            <Monitor className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                {isPreviewDate ? selectedDateKey : "Heute"}
              </p>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                Heute auf Display 1
              </p>
            </div>
          </div>
          <span className="shrink-0 rounded-full bg-[var(--surface-3)] px-2.5 py-1 text-[0.72rem] font-semibold tabular-nums text-[var(--text-2)]">
            {summary.counts.visibleToday}{" "}
            {summary.counts.visibleToday === 1 ? "Event" : "Events"}
          </span>
        </div>
        <div className="sce-detail-section-body p-0">
          <InfoboardTodayList events={summary.events} />
        </div>
      </div>

      {/* Legacy display notice */}
      <div className="rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] px-5 py-4">
        <div className="flex flex-wrap items-start gap-3">
          <div className="flex-1 space-y-1">
            <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
              Legacy-Display
            </p>
            <p className="text-sm text-[var(--muted)]">
              Das frühere Display unter{" "}
              <code className="font-mono text-[0.72rem] text-[var(--foreground)]">
                /infoboard
              </code>{" "}
              bleibt vorübergehend technisch bestehen, wird jedoch nicht mehr als primäres
              Infoboard verwendet.
            </p>
          </div>
        </div>
      </div>

      {/* Roadmap section */}
      <div className="sce-detail-section">
        <div className="sce-detail-section-header">
          <div className="flex min-w-0 items-center gap-3">
            <Construction className="h-4 w-4 shrink-0 text-[var(--muted)]" />
            <div>
              <p className="text-[0.72rem] font-semibold uppercase tracking-[0.10em] text-[var(--muted)]">
                Geplant
              </p>
              <p className="text-sm font-semibold text-[var(--foreground)]">
                In Vorbereitung
              </p>
            </div>
          </div>
        </div>
        <div className="sce-detail-section-body">
          <ul className="space-y-2">
            {[
              "Display 2 — Sportanlage",
              "Ankündigungsleiste verwalten",
              "Branding verwalten",
              "Live-Aktualisierung und Verbindungsstatus",
            ].map((item) => (
              <li key={item} className="flex items-center gap-2 text-sm text-[var(--muted)]">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--muted)] opacity-40" />
                {item}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
