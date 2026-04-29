import { notFound } from "next/navigation";
import RegistrationProfileWrapper from "@/components/admin/registrations/RegistrationProfileWrapper";
import { prisma } from "@/lib/db/prisma";

export default async function RegistrationDetailPage({
  params,
}: {
  params: Promise<{ registrationId: string }>;
}) {
  const { registrationId } = await params;

  const registration = await prisma.registration.findUnique({
    where: { id: registrationId },
  });

  if (!registration) {
    notFound();
  }

  return <RegistrationProfileWrapper registration={registration} />;
}
