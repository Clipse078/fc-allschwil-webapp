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
