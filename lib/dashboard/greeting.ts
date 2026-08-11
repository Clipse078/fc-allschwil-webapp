/**
 * lib/dashboard/greeting.ts — DASHBOARD-SHELL-UX-01
 *
 * Localized (German) personalised dashboard greeting.
 *
 * Uses the authenticated Person/User's first name (via session.user.firstName
 * — no new persistence model). Falls back to a neutral German salutation
 * when no first name is available. Never falls back to tenant name, role
 * name, or email address.
 */

const FALLBACK_NAME = "zusammen";

/**
 * Returns a time-of-day appropriate German greeting for the given first
 * name, e.g. "Guten Morgen, Michael 👋".
 *
 * @param firstName - The authenticated person's first name, if known.
 * @param now - Injectable clock for testing. Defaults to the current time.
 */
export function getPersonalizedGreeting(
  firstName: string | null | undefined,
  now: Date = new Date(),
): string {
  const name = firstName?.trim() || FALLBACK_NAME;
  const hour = now.getHours();

  if (hour >= 5 && hour < 12) return `Guten Morgen, ${name} 👋`;
  if (hour >= 12 && hour < 18) return `Guten Tag, ${name} 👋`;
  return `Guten Abend, ${name} 👋`;
}

/**
 * DASHBOARD-SHELL-UX-01-C1 — resolves which first name the dashboard
 * greeting should use.
 *
 * Prefers the canonically linked Person's first name (Person.userId, see
 * ADMIN-MASTERDATA-UX-01) over `session.user.firstName`, since the latter is
 * the raw `User.firstName` column — which for some bootstrapped accounts
 * (e.g. tenant club-admin seed users) was populated with the tenant/club
 * name rather than a person's name.
 *
 * As a safety net, a candidate that matches the active tenant's name
 * (case-insensitively) is always treated as unusable, so a club/tenant name
 * can never surface as the greeting identity even if it leaked into
 * `session.user.firstName`. Returns `undefined` when no usable name is
 * found, letting {@link getPersonalizedGreeting} apply its generic fallback.
 */
export function resolveDashboardFirstName(candidates: {
  linkedPersonFirstName?: string | null;
  sessionFirstName?: string | null;
  tenantName?: string | null;
}): string | undefined {
  const tenantName = candidates.tenantName?.trim().toLowerCase();
  const isTenantName = (value: string) => !!tenantName && value.trim().toLowerCase() === tenantName;

  const personFirstName = candidates.linkedPersonFirstName?.trim();
  if (personFirstName && !isTenantName(personFirstName)) return personFirstName;

  const sessionFirstName = candidates.sessionFirstName?.trim();
  if (sessionFirstName && !isTenantName(sessionFirstName)) return sessionFirstName;

  return undefined;
}
