import { notFound } from "next/navigation";
import RegistrationProfileWrapper from "@/components/admin/registrations/RegistrationProfileWrapper";
import { PageShell } from "@/components/shared/page";
import { prisma } from "@/lib/db/prisma";

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const { registrationId } = await params;

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
    include: {
      workflowSteps: {
        orderBy: { sortOrder: "asc" },
        include: {
          assignedRole: true,
          assignedPerson: true,
        },
      },
      linkedPerson: true,
    },
  });

  if (!registration) {
    notFound();
  }

  return (
    <PageShell>
      <RegistrationProfileWrapper registration={registration} />
    </PageShell>
  );
}
