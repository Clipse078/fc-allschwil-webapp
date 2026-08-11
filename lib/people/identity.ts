/**
 * lib/people/identity.ts — DASHBOARD-SHELL-UX-01-C2
 *
 * Resolves the human-person identity used to label a User account in the
 * admin shell (e.g. the sidebar footer, directly above "Abmelden"). Never
 * renders a role name, a tenant name, or an email address as the primary
 * identity — the primary identity is always a human person's name.
 */

const FALLBACK_LABEL = { firstName: "Mein Konto", lastName: "" };

/**
 * Resolves which name should represent the authenticated account.
 *
 * Priority:
 *   1. The canonically linked Person's full name (Person.userId, see
 *      ADMIN-MASTERDATA-UX-01) — the human person's real name.
 *   2. `session.user.firstName`/`lastName` (the raw User columns), but only
 *      when the first name doesn't match the active tenant's name — some
 *      bootstrapped tenant accounts (e.g. tenant club-admin seed users) have
 *      `User.firstName`/`lastName` populated with the tenant/club name and
 *      role label instead of a person's name.
 *   3. A generic, safe account label — never a role name.
 */
export function resolveAccountIdentityName(candidates: {
  linkedPerson?: { firstName?: string | null; lastName?: string | null } | null;
  sessionFirstName?: string | null;
  sessionLastName?: string | null;
  tenantName?: string | null;
}): { firstName: string; lastName: string } {
  const tenantName = candidates.tenantName?.trim().toLowerCase();
  const isTenantName = (value: string) => !!tenantName && value.trim().toLowerCase() === tenantName;

  const personFirstName = candidates.linkedPerson?.firstName?.trim();
  if (personFirstName && !isTenantName(personFirstName)) {
    return {
      firstName: personFirstName,
      lastName: candidates.linkedPerson?.lastName?.trim() || "",
    };
  }

  const sessionFirstName = candidates.sessionFirstName?.trim();
  if (sessionFirstName && !isTenantName(sessionFirstName)) {
    return {
      firstName: sessionFirstName,
      lastName: candidates.sessionLastName?.trim() || "",
    };
  }

  return { ...FALLBACK_LABEL };
}
