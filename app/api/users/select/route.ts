/**
 * GET /api/users/select
 *
 * Lightweight user list for allowlist pickers (VisibleUsersSelect).
 * Returns only { id, name, email } for active users — no sensitive fields.
 *
 * Auth: session only (any authenticated user may see the user directory
 * in a small-club context). This is intentionally lower than the full
 * /api/users endpoint which requires USERS_MANAGE.
 *
 * TODO: Phase B — org-unit scoping
 *   When OrgUnit exists, filter to users within the actor's org unit(s)
 *   so actors can only grant visibility to users they are aware of.
 *
 * TODO: Phase B — permission gate option
 *   If user directory exposure must be restricted (multi-tenant), gate with
 *   a dedicated permission key (e.g. users.select) seeded for relevant roles.
 */

import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const users = await prisma.user.findMany({
    where: { isActive: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
    },
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      name: `${u.firstName} ${u.lastName}`,
      email: u.email,
    })),
  );
}
