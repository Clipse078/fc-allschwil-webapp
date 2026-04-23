import { prisma } from "@/lib/db/prisma";

export type OrganigrammPersonCard = {
  id: string;
  name: string;
  initials: string;
  roleLabel: string;
  email: string | null;
  phone: string | null;
  photoUrl: string | null;
};

export type OrganigrammRoleNode = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  mode: "single" | "group";
  people: OrganigrammPersonCard[];
  isUnassigned: boolean;
};

export type OrganigrammDepartmentSection = {
  id: string;
  key: string;
  title: string;
  description: string | null;
  accent: {
    from: string;
    via: string;
    to: string;
  };
  roles: OrganigrammRoleNode[];
};

export type OrganigrammOverview = {
  departments: OrganigrammDepartmentSection[];
  unassignedRoles: OrganigrammRoleNode[];
  stats: {
    departmentCount: number;
    roleCount: number;
    assignedCardsCount: number;
    unassignedRoleCount: number;
  };
};

function getDisplayName(person: {
  firstName: string;
  lastName: string;
  displayName: string | null;
}) {
  const fallback = [person.firstName, person.lastName].filter(Boolean).join(" ").trim();
  return person.displayName?.trim() || fallback || "Unbekannt";
}

function getInitials(name: string) {
  const parts = name
    .split(" ")
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (parts.length === 0) {
    return "--";
  }

  return parts.map((part) => part.charAt(0).toUpperCase()).join("");
}

function dedupePeople(people: OrganigrammPersonCard[]) {
  const seen = new Set<string>();

  return people.filter((person) => {
    if (seen.has(person.id)) {
      return false;
    }

    seen.add(person.id);
    return true;
  });
}

function mapRoleWithPeople(role: {
  id: string;
  key: string;
  name: string;
  description: string | null;
  organigrammDisplayName: string | null;
  organigrammDescription: string | null;
  organigrammIsGroupRole: boolean;
  userRoles: Array<{
    user: {
      person: {
        id: string;
        firstName: string;
        lastName: string;
        displayName: string | null;
        email: string | null;
        phone: string | null;
        isActive: boolean;
      } | null;
    };
  }>;
}): OrganigrammRoleNode {
  const people = dedupePeople(
    role.userRoles
      .map((userRole): OrganigrammPersonCard | null => {
        const person = userRole.user.person;

        if (!person || !person.isActive) {
          return null;
        }

        const name = getDisplayName(person);

        return {
          id: person.id,
          name,
          initials: getInitials(name),
          roleLabel: role.organigrammDisplayName?.trim() || role.name,
          email: person.email,
          phone: person.phone,
          photoUrl: null,
        };
      })
      .filter((value): value is OrganigrammPersonCard => value !== null),
  ).sort((a, b) => a.name.localeCompare(b.name, "de-CH"));

  return {
    id: role.id,
    key: role.key,
    title: role.organigrammDisplayName?.trim() || role.name,
    description: role.organigrammDescription?.trim() || role.description,
    mode: role.organigrammIsGroupRole ? "group" : "single",
    people,
    isUnassigned: people.length === 0,
  };
}

export async function getOrganigrammOverview(): Promise<OrganigrammOverview> {
  const [departments, unassignedRoles] = await Promise.all([
    prisma.organigrammDepartment.findMany({
      where: {
        isActive: true,
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        roles: {
          orderBy: [{ organigrammSortOrder: "asc" }, { name: "asc" }],
          include: {
            userRoles: {
              include: {
                user: {
                  include: {
                    person: true,
                  },
                },
              },
            },
          },
        },
      },
    }),
    prisma.role.findMany({
      where: {
        organigrammDepartmentId: null,
      },
      orderBy: [{ organigrammSortOrder: "asc" }, { name: "asc" }],
      include: {
        userRoles: {
          include: {
            user: {
              include: {
                person: true,
              },
            },
          },
        },
      },
    }),
  ]);

  const mappedDepartments: OrganigrammDepartmentSection[] = departments.map((department) => ({
    id: department.id,
    key: department.key,
    title: department.name,
    description: department.description,
    accent: {
      from: department.accentFrom,
      via: department.accentVia,
      to: department.accentTo,
    },
    roles: department.roles.map(mapRoleWithPeople),
  }));

  const mappedUnassignedRoles = unassignedRoles.map(mapRoleWithPeople);

  const assignedCardsCount =
    mappedDepartments.reduce((sum, department) => {
      return (
        sum +
        department.roles.reduce((roleSum, role) => {
          return roleSum + role.people.length;
        }, 0)
      );
    }, 0) +
    mappedUnassignedRoles.reduce((sum, role) => sum + role.people.length, 0);

  const roleCount =
    mappedDepartments.reduce((sum, department) => sum + department.roles.length, 0) +
    mappedUnassignedRoles.length;

  return {
    departments: mappedDepartments,
    unassignedRoles: mappedUnassignedRoles,
    stats: {
      departmentCount: mappedDepartments.length,
      roleCount,
      assignedCardsCount,
      unassignedRoleCount: mappedUnassignedRoles.length,
    },
  };
}
