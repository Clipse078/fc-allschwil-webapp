/**
 * Tenant-Aware Formatting Helpers — Slice 10.3
 *
 * All helpers accept a TenantContext (or a Pick of it) and apply the tenant's
 * locale, timezone, and currency settings. Safe fallbacks apply when config
 * fields are null:
 *
 *   locale   → "de-CH"  (platform default)
 *   timezone → "Europe/Zurich"
 *   currency → "CHF"
 *
 * Fallbacks are wrapped in try/catch so invalid config values (e.g. a typo in
 * the timezone field) never crash the server — they produce a raw string instead.
 *
 * These helpers are server-safe (no `window`, no `document`). Intl is available
 * in Node.js 18+ and the Next.js edge/node runtimes.
 */

import type { TenantContext } from "@/lib/tenants/context";

// ── Internal resolvers with safe fallbacks ────────────────────────────────────

type LocaleCtx = Pick<TenantContext, "locale">;
type TimezoneCtx = Pick<TenantContext, "timezone">;
type CurrencyCtx = Pick<TenantContext, "currency">;

function resolveLocale(ctx: LocaleCtx): string {
  return ctx.locale ?? "de-CH";
}

function resolveTimezone(ctx: TimezoneCtx): string {
  return ctx.timezone ?? "Europe/Zurich";
}

function resolveCurrency(ctx: CurrencyCtx): string {
  return ctx.currency ?? "CHF";
}

// ── Currency formatting ───────────────────────────────────────────────────────

/**
 * Formats a numeric amount as a currency string using the tenant's locale and
 * currency code. Falls back to "<CURRENCY> <amount>" if Intl fails.
 *
 * @example
 *   formatCurrency(1234.5, ctx)  // "CHF 1'234.50"  (de-CH / CHF)
 *   formatCurrency(1234.5, ctx)  // "€1,234.50"     (en-GB / EUR)
 */
export function formatCurrency(
  amount: number,
  ctx: LocaleCtx & CurrencyCtx,
): string {
  try {
    return new Intl.NumberFormat(resolveLocale(ctx), {
      style: "currency",
      currency: resolveCurrency(ctx),
    }).format(amount);
  } catch {
    return `${resolveCurrency(ctx)} ${amount.toFixed(2)}`;
  }
}

// ── Date formatting ───────────────────────────────────────────────────────────

/**
 * Formats a date using the tenant's locale and timezone.
 * Default style: "3. Juni 2026" (de-CH day+month+year).
 * Pass `options` to override any Intl.DateTimeFormatOptions.
 *
 * @example
 *   formatDate(new Date(), ctx)              // "3. Juni 2026"
 *   formatDate(new Date(), ctx, { month: "short" })  // "3. Jun. 2026"
 */
export function formatDate(
  date: Date | string,
  ctx: LocaleCtx & TimezoneCtx,
  options?: Intl.DateTimeFormatOptions,
): string {
  try {
    const d = typeof date === "string" ? new Date(date) : date;
    return new Intl.DateTimeFormat(resolveLocale(ctx), {
      timeZone: resolveTimezone(ctx),
      day: "2-digit",
      month: "long",
      year: "numeric",
      ...options,
    }).format(d);
  } catch {
    const d = typeof date === "string" ? new Date(date) : date;
    return d.toISOString().split("T")[0];
  }
}

/**
 * Formats a date-time using the tenant's locale and timezone.
 * Style: "03. Jun. 2026, 11:30"
 *
 * @example
 *   formatDateTime(registration.submittedAt, ctx)  // "03. Jun. 2026, 11:30"
 */
export function formatDateTime(
  date: Date | string,
  ctx: LocaleCtx & TimezoneCtx,
): string {
  return formatDate(date, ctx, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Formats a date as a compact short date: "03.06.2026"
 */
export function formatShortDate(
  date: Date | string,
  ctx: LocaleCtx & TimezoneCtx,
): string {
  return formatDate(date, ctx, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
