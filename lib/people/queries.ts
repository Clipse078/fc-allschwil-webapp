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
    },
  });

  return persons.map((p) => ({
    id: p.id,
    name: p.displayName || `${p.firstName} ${p.lastName}`,
    email: p.email,
    phone: p.phone,
    isActive: p.isActive,
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
    },
  });
}

export type PersonListItem = Awaited<ReturnType<typeof getPersons>>[number];
export type PersonDetail = NonNullable<Awaited<ReturnType<typeof getPersonById>>>;
