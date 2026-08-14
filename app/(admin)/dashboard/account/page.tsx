/**
 * Mein Konto — self-service account page (MEIN-KONTO-01)
 *
 * Server component: fetches User + linked Person data, then delegates
 * rendering and interaction to the client component.
 *
 * Auth gate: the (admin) layout already redirects unauthenticated requests
 * to /login, so no extra guard is needed here. No special permission is
 * required — every authenticated user can view and edit their own account.
 */

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { PageShell } from "@/components/ui/page";
import AccountPageClient from "./AccountPageClient";

export const metadata = { title: "Mein Konto" };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const userId = session.user.id;
  const activeTenantId = session.user.activeTenantId;

  // Fetch User record
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      isActive: true,
      lastLoginAt: true,
    },
  });

  if (!user) {
    redirect("/login");
  }

  // Fetch the linked Person in the current tenant (if any)
  const linkedPerson = activeTenantId
    ? await prisma.person.findFirst({
        where: { userId, tenantId: activeTenantId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          imageUrl: true,
          isActive: true,
        },
      })
    : null;

  // Resolve tenant name for display
  let tenantName: string | null = null;
  if (activeTenantId) {
    const tenant = await prisma.tenant.findUnique({
      where: { id: activeTenantId },
      select: { name: true },
    });
    tenantName = tenant?.name ?? null;
  }

  return (
    <PageShell>
      <AccountPageClient
        user={{
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
        }}
        linkedPerson={
          linkedPerson
            ? {
                id: linkedPerson.id,
                firstName: linkedPerson.firstName,
                lastName: linkedPerson.lastName,
                phone: linkedPerson.phone ?? null,
                imageUrl: linkedPerson.imageUrl ?? null,
              }
            : null
        }
        tenantName={tenantName}
      />
    </PageShell>
  );
}
