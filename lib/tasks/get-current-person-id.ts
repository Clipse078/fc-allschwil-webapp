import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";

export async function getCurrentPersonId() {
  const session = await auth();

  if (!session?.user?.id) return null;

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { personId: true },
  });

  return user?.personId ?? null;
}
