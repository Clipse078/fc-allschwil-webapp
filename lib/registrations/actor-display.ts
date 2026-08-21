/**
 * lib/registrations/actor-display.ts
 *
 * REG-WAIT-01H — presentation-only audit actor identity for registration Verlauf.
 * Preserves the underlying User/account reference; only affects rendered labels.
 */

type LinkedPerson = {
  firstName: string;
  lastName: string;
  displayName: string | null;
};

export type AuditActorShape = {
  firstName: string;
  lastName: string;
  email: string;
  person?: LinkedPerson | null;
};

function linkedPersonFullName(person: LinkedPerson): string | null {
  if (person.displayName?.trim()) {
    return person.displayName.trim();
  }
  const fullName = `${person.firstName} ${person.lastName}`.trim();
  return fullName || null;
}

function userFullName(actor: AuditActorShape): string | null {
  const fullName = `${actor.firstName} ${actor.lastName}`.trim();
  return fullName || null;
}

function looksLikeTechnicalAccountName(name: string): boolean {
  return /\bclub admin\b/i.test(name) || /\bservice account\b/i.test(name);
}

/**
 * Resolves the best human-facing display identity for an audit actor.
 *
 * Fallback order:
 * 1. linked Person full name
 * 2. meaningful User display/full name
 * 3. User email
 * 4. technical account name
 */
export function resolveAuditActorDisplayName(actor: AuditActorShape | null | undefined): string | null {
  if (!actor) return null;

  const personName = actor.person ? linkedPersonFullName(actor.person) : null;
  if (personName) return personName;

  const accountName = userFullName(actor);
  if (accountName && !looksLikeTechnicalAccountName(accountName)) {
    return accountName;
  }

  const email = actor.email?.trim();
  if (email) return email;

  return accountName;
}
