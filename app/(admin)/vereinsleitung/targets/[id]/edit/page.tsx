import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTargetById } from "@/lib/targets/queries";
import TargetForm from "@/components/admin/targets/TargetForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { ArrowLeft } from "lucide-react";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EditTargetPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { id } = await params;
  const target = await getTargetById(id);

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
    </div>
  );
}
