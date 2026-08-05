/**
 * Canonical Tenant Runtime Formatters — Slice 10.5
 *
 * Single source of truth for all tenant-context-aware formatting.
 * No other file in the codebase may define its own date/time/currency/season
 * formatter that accepts or derives from tenant configuration.
 *
 * ─── How to use ────────────────────────────────────────────────────────────
 *
 * 1. Server components / API routes:
 *    Pass the full TenantContext (superset of TenantFormatConfig) directly:
 *
 *    import { formatDate } from "@/lib/tenant-runtime/formatters";
 *    const ctx = await getCurrentTenantContext();
 *    const label = formatDate(record.createdAt, ctx);  // ctx satisfies TenantFormatConfig
 *
 * 2. Client components receiving string props from the server:
 *
 *    import { formatDate } from "@/lib/tenant-runtime/formatters";
 *    // props: locale?: string; timezone?: string
 *    const label = formatDate(record.createdAt, { locale, timezone });
 *
 * ─── Fallbacks ─────────────────────────────────────────────────────────────
 *
 * All functions are null-safe. When a config field is null/undefined the
 * function falls back to a safe platform default:
 *   locale   → "de-CH"
 *   timezone → "Europe/Zurich"
 *   currency → "CHF"
 *   seasonTransitionMonth → 8  (August)
 *   seasonTransitionDay   → 1
 *
 * Intl failures (invalid locale/tz) are caught and produce a raw ISO fallback.
 *
 * ─── Client safety ─────────────────────────────────────────────────────────
 *
 * This module is pure (Intl only). No prisma, no next/headers, no next/server.
 * It is safe to import from client components.
 *
 * ─── Canonical function list ───────────────────────────────────────────────
 *
 *   formatDate(date, cfg, opts?)     "03. Juni 2026"
 *   formatDateShort(date, cfg)       "03.06.2026"
 *   formatDateTime(date, cfg)        "3. Juni 2026 um 12:30"
 *   formatDateTimeCompact(date, cfg) "03.06.2026 · 12:30"
 *   formatTime(date, cfg)            "10:00"
 *   formatTodayDate(cfg)             "Mittwoch, 03. Juni 2026"
 *   formatCurrency(amount, cfg)      "CHF 1'234.50"
 *   getCurrentSeasonLabel(cfg, now?) "2025/2026"
 */

// ── Config type ───────────────────────────────────────────────────────────────

/**
 * Minimal config required by the formatters.
 * The full TenantContext (server-side) is a superset of this type and can be
 * passed directly. Client components pass plain string props instead.
 */
export type TenantFormatConfig = {
  locale?: string | null;
  timezone?: string | null;
  currency?: string | null;
  /** 1-based month (1=Jan…12=Dec). Defaults to 8 (August). */
  seasonTransitionMonth?: number | null;
  /** Day within seasonTransitionMonth. Defaults to 1. */
  seasonTransitionDay?: number | null;
};

// ── Internal resolvers ────────────────────────────────────────────────────────

const PLATFORM_LOCALE = "de-CH";
const PLATFORM_TIMEZONE = "Europe/Zurich";
const PLATFORM_CURRENCY = "CHF";
const PLATFORM_SEASON_TRANSITION_MONTH = 8;
const PLATFORM_SEASON_TRANSITION_DAY = 1;

function locale(cfg: TenantFormatConfig): string {
  return cfg.locale ?? PLATFORM_LOCALE;
}

function timezone(cfg: TenantFormatConfig): string {
  return cfg.timezone ?? PLATFORM_TIMEZONE;
}

function currency(cfg: TenantFormatConfig): string {
  return cfg.currency ?? PLATFORM_CURRENCY;
}

function toDate(value: Date | string): Date {
  return typeof value === "string" ? new Date(value) : value;
}

// ── Date & time formatters ────────────────────────────────────────────────────

/**
 * Long date: "03. Juni 2026"
 * Pass custom Intl.DateTimeFormatOptions to override individual fields.
 */
export function formatDate(
  date: Date | string,
  cfg: TenantFormatConfig,
  options?: Intl.DateTimeFormatOptions,
): string {
  try {
    return new Intl.DateTimeFormat(locale(cfg), {
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: timezone(cfg),
      ...options,
    }).format(toDate(date));
  } catch {
    return toDate(date).toISOString().split("T")[0];
  }
}

/**
 * Short date: "03.06.2026"
 */
export function formatDateShort(date: Date | string, cfg: TenantFormatConfig): string {
  try {
    return new Intl.DateTimeFormat(locale(cfg), {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      timeZone: timezone(cfg),
    }).format(toDate(date));
  } catch {
    return toDate(date).toISOString().split("T")[0];
  }
}

/**
 * Long date + time: "3. Juni 2026 um 12:30"
 */
export function formatDateTime(date: Date | string, cfg: TenantFormatConfig): string {
  try {
    return new Intl.DateTimeFormat(locale(cfg), {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: timezone(cfg),
    }).format(toDate(date));
  } catch {
    return toDate(date).toISOString();
  }
}

/**
 * Compact date + time: "03.06.2026 · 12:30"
 *
 * REGISTRATION-01D: used wherever an exact, never-hidden timestamp must be
 * shown alongside a relative-time label (e.g. "Heute", "Vor 4 Tagen").
 */
export function formatDateTimeCompact(date: Date | string, cfg: TenantFormatConfig): string {
  return `${formatDateShort(date, cfg)} · ${formatTime(date, cfg)}`;
}

/**
 * Time only: "10:00"
 */
export function formatTime(date: Date | string, cfg: TenantFormatConfig): string {
  try {
    return new Intl.DateTimeFormat(locale(cfg), {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: timezone(cfg),
    }).format(toDate(date));
  } catch {
    return toDate(date).toISOString().slice(11, 16);
  }
}

/**
 * Today's date with weekday: "Mittwoch, 03. Juni 2026"
 */
export function formatTodayDate(cfg: TenantFormatConfig): string {
  try {
    return new Intl.DateTimeFormat(locale(cfg), {
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
      timeZone: timezone(cfg),
    }).format(new Date());
  } catch {
    return new Date().toISOString().split("T")[0];
  }
}

// ── Currency formatter ────────────────────────────────────────────────────────

/**
 * Currency: "CHF 1'234.50"
 */
export function formatCurrency(amount: number, cfg: TenantFormatConfig): string {
  try {
    return new Intl.NumberFormat(locale(cfg), {
      style: "currency",
      currency: currency(cfg),
    }).format(amount);
  } catch {
    return `${currency(cfg)} ${amount.toFixed(2)}`;
  }
}

// ── Season label ──────────────────────────────────────────────────────────────

/**
 * Current season label: "2025/2026"
 *
 * Uses cfg.seasonTransitionMonth (1-based) and cfg.seasonTransitionDay to
 * determine which season year a date belongs to. Same algorithm as
 * lib/tenants/season-boundary.ts getSeasonStartYearFromDate().
 */
export function getCurrentSeasonLabel(
  cfg: TenantFormatConfig,
  now: Date | string = new Date(),
): string {
  const d = toDate(now);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1; // 1-based
  const day = d.getUTCDate();

  const tm = cfg.seasonTransitionMonth ?? PLATFORM_SEASON_TRANSITION_MONTH;
  const td = cfg.seasonTransitionDay ?? PLATFORM_SEASON_TRANSITION_DAY;

  const startYear =
    month > tm || (month === tm && day >= td) ? year : year - 1;
  return `${startYear}/${startYear + 1}`;
}
