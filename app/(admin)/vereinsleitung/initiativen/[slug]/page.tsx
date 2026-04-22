import { notFound } from "next/navigation";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import VereinsleitungInitiativeDetail, {
  type InitiativeDetailWorkItem,
} from "@/components/admin/vereinsleitung/VereinsleitungInitiativeDetail";
import { prisma } from "@/lib/db/prisma";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { ROUTE_PERMISSION_SETS } from "@/lib/permissions/route-permission-sets";

type InitiativeSlugPageProps = {
  params: Promise<{
    slug: string;
  }>;
};

export default async function InitiativeSlugPage({
  params,
}: InitiativeSlugPageProps) {
  await requireAnyPermission(ROUTE_PERMISSION_SETS.VEREINSLEITUNG_INITIATIVES_READ);

  const resolvedParams = await params;

  const initiative = await prisma.vereinsleitungInitiative.findUnique({
    where: {
      slug: resolvedParams.slug,
    },
    include: {
      owner: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          displayName: true,
          email: true,
          phone: true,
        },
      },
      workItems: {
        orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        include: {
          assigneePerson: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayName: true,
            },
          },
        },
      },
    },
  });

  if (!initiative) {
    notFound();
  }

  const workItems: InitiativeDetailWorkItem[] = initiative.workItems.map((item) => {
    const personAssigneeName =
      item.assigneePerson?.displayName ??
      ([item.assigneePerson?.firstName, item.assigneePerson?.lastName]
        .filter(Boolean)
        .join(" ") || null);

    const assigneeName =
      item.assigneeMode === "EXTERNAL"
        ? item.externalAssigneeLabel || "Extern"
        : personAssigneeName || "Nicht zugewiesen";

    return {
      id: item.id,
      title: item.title,
      priority: item.priority,
      storyPoints: item.storyPoints,
      assigneeMode: item.assigneeMode,
      assigneePersonId: item.assigneePersonId,
      externalAssigneeLabel: item.externalAssigneeLabel,
      assigneeName,
      status: item.status,
      sortOrder: item.sortOrder,
    };
  });

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Vereinsleitung"
        title={initiative.title}
        description={initiative.subtitle ?? "Initiativen Details"}
      />

      <VereinsleitungInitiativeDetail
        initiative={{
          id: initiative.id,
          slug: initiative.slug,
          title: initiative.title,
          subtitle: initiative.subtitle,
          description: initiative.description,
          status: initiative.status,
          startDateIso: initiative.startDate ? initiative.startDate.toISOString() : null,
          targetDateIso: initiative.targetDate ? initiative.targetDate.toISOString() : null,
          ownerRoleLabel: initiative.ownerRoleLabel,
          ownerName:
            initiative.owner?.displayName ??
            [initiative.owner?.firstName, initiative.owner?.lastName]
              .filter(Boolean)
              .join(" ") ??
            "Nicht zugewiesen",
          ownerPerson: initiative.owner
            ? {
                id: initiative.owner.id,
                firstName: initiative.owner.firstName,
                lastName: initiative.owner.lastName,
                displayName:
                  initiative.owner.displayName ??
                  [initiative.owner.firstName, initiative.owner.lastName]
                    .filter(Boolean)
                    .join(" "),
                email: initiative.owner.email,
                phone: initiative.owner.phone,
                imageSrc: null,
                functionLabel: initiative.ownerRoleLabel,
                teamLabel: null,
              }
            : null,
        }}
        workItems={workItems}
      />
    </div>
  );
}