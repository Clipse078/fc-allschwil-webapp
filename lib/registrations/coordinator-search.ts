/**
 * lib/registrations/coordinator-search.ts
 *
 * REG-WAIT-01F — Shared coordinator search matching for picker UIs.
 * Uses prefix / token matching on human-facing fields only — avoids
 * false positives such as "mi" matching "Ad**mi**n".
 */

import type { AssignableUser } from "./workflow-types";

export function matchesCoordinatorSearch(user: AssignableUser, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return false;

  const firstName = user.firstName.trim().toLowerCase();
  const lastName = user.lastName.trim().toLowerCase();
  const fullName = `${firstName} ${lastName}`.trim();
  const email = user.email.trim().toLowerCase();
  const emailLocal = email.split("@")[0] ?? "";

  const searchable = [firstName, lastName, fullName, emailLocal, email];
  return searchable.some((field) => field.length > 0 && field.startsWith(q));
}

export function filterCoordinatorsBySearch(
  coordinators: AssignableUser[],
  query: string,
  limit = 12,
): AssignableUser[] {
  const q = query.trim();
  if (q.length < 2) return [];
  return coordinators.filter((user) => matchesCoordinatorSearch(user, q)).slice(0, limit);
}
