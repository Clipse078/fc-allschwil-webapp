import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTargetById } from "@/lib/targets/queries";
import { getMeetingLinkOptions, getInitiativeLinkOptions } from "@/lib/linking/queries";
import { buildActorContext } from "@/lib/visibility/actor-context";
import TargetForm from "@/components/admin/targets/TargetForm";
import TargetLinkEditor from "@/components/admin/targets/TargetLinkEditor";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { parseEntityRefs } from "@/lib/linking/helpers";
import { ArrowLeft } from "lucide-react";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTargetPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const actor = buildActorContext(session.user);

  // Fetch target and link options in parallel — all respect VisibilityScope
  const [target, availableMeetings, availableInitiatives] = await Promise.all([
    getTargetById(id, actor),
    getMeetingLinkOptions(actor),
    getInitiativeLinkOptions(actor),
  ]);

  if (!target) notFound();

  const defaultValues = {
    title: target.title,
    description: target.description ?? "",
    category: target.category,
    status: target.status,
    period: target.period,
    periodLabel: target.periodLabel ?? "",
    moduleKey: target.moduleKey ?? "",
    sportCategory: target.sportCategory ?? "",
    ageGroupHint: target.ageGroupHint ?? "",
    startsAt: target.startsAt ? new Date(target.startsAt).toISOString().substring(0, 10) : "",
    endsAt: target.endsAt ? new Date(target.endsAt).toISOString().substring(0, 10) : "",
    visibilityScope: target.visibilityScope as "ORGANISATION" | "RESTRICTED" | "PRIVATE",
    visibleOrgUnitRefs: Array.isArray(target.visibleOrgUnitRefs)
      ? (target.visibleOrgUnitRefs as string[]).filter((v) => typeof v === "string")
      : [],
    visibleRoleRefs: Array.isArray(target.visibleRoleRefs)
      ? (target.visibleRoleRefs as string[]).filter((v) => typeof v === "string")
      : [],
    visibleUserRefs: Array.isArray(target.visibleUserRefs)
      ? (target.visibleUserRefs as string[]).filter((v) => typeof v === "string")
      : [],
    metrics: target.metrics.map((m) => ({
      id: m.id,
      label: m.label,
      type: m.type,
      direction: m.direction,
      targetValue: String(m.targetValue),
      currentValue: String(m.currentValue),
      unit: m.unit ?? "",
      notes: m.notes ?? "",
    })),
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Ziele"
        title="Ziel bearbeiten"
        description={`Bearbeite: ${target.title}`}
        actions={
          <Link
            href={`/vereinsleitung/targets/${id}`}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zurück
          </Link>
        }
      />

      <TargetForm mode="edit" targetId={id} defaultValues={defaultValues} />

      <TargetLinkEditor
        targetId={id}
        initialInitiativeRefs={parseEntityRefs(target.linkedInitiativeRefs)}
        initialMeetingRefs={parseEntityRefs(target.linkedMeetingRefs)}
        availableInitiatives={availableInitiatives}
        availableMeetings={availableMeetings}
      />
    </div>
  );
}
