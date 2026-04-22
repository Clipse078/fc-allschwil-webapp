import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";

type InitiativeEditPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function InitiativeEditPage({
  params,
}: InitiativeEditPageProps) {
  const resolvedParams = await params;

  const initiative = await prisma.vereinsleitungInitiative.findUnique({
    where: { slug: resolvedParams.slug },
    select: { slug: true },
  });

  if (!initiative) {
    notFound();
  }

  redirect("/vereinsleitung/initiativen/" + initiative.slug + "#initiative-editor");
}