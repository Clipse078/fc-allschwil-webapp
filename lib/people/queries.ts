/**
 * People query helpers — server-only.
 */

import { prisma } from "@/lib/db/prisma";

export async function getPersons() {
  const persons = await prisma.person.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phone: true,
      isActive: true,
      isPlayer: true,
      isTrainer: true,
    },
  });

  return persons.map((p) => ({
    id: p.id,
    name: p.displayName || `${p.firstName} ${p.lastName}`,
    email: p.email,
    phone: p.phone,
    isActive: p.isActive,
    isPlayer: p.isPlayer,
    isTrainer: p.isTrainer,
  }));
}

export async function getPersonById(id: string) {
  return prisma.person.findUnique({
    where: { id },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      notes: true,
      isActive: true,
      isPlayer: true,
      isTrainer: true,
      createdAt: true,
      updatedAt: true,
      // ADMIN-MASTERDATA-UX-01: canonical, explicit Person <-> User link
      // (Person.userId). Never resolved via email-string matching.
      userId: true,
      user: {
        select: { id: true, email: true, isActive: true },
      },
    },
  });
}

/**
 * DASHBOARD-SHELL-UX-01-C1 — resolves the first name of the Person canonically
 * linked to a User (Person.userId, see ADMIN-MASTERDATA-UX-01), for display
 * purposes (e.g. the dashboard greeting). Returns null when the User has no
 * linked Person, or the linked Person has no usable first name. Never derives
 * a name from email, tenant, or role data.
 */
export async function getPersonFirstNameByUserId(userId: string): Promise<string | null> {
  const person = await prisma.person.findUnique({
    where: { userId },
    select: { firstName: true },
  });

  return person?.firstName?.trim() || null;
}

/**
 * DASHBOARD-SHELL-UX-01-C2 — resolves the full name (firstName + lastName) of
 * the Person canonically linked to a User (Person.userId, see
 * ADMIN-MASTERDATA-UX-01), for display purposes (e.g. the sidebar footer
 * identity). Returns null when the User has no linked Person, or the linked
 * Person has no usable first name. Never derives a name from email, tenant,
 * or role data.
 */
export async function getPersonNameByUserId(
  userId: string,
): Promise<{ firstName: string; lastName: string } | null> {
  const person = await prisma.person.findUnique({
    where: { userId },
    select: { firstName: true, lastName: true },
  });

  const firstName = person?.firstName?.trim();
  if (!firstName) return null;

  return { firstName, lastName: person?.lastName?.trim() || "" };
}

export type PersonListItem = Awaited<ReturnType<typeof getPersons>>[number];
export type PersonDetail = NonNullable<Awaited<ReturnType<typeof getPersonById>>>;
