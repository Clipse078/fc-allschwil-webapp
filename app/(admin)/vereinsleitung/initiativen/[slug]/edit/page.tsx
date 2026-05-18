import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getInitiativeBySlug } from "@/lib/initiatives/queries";
import { buildActorContext } from "@/lib/visibility/actor-context";
import InitiativeForm from "@/components/admin/initiatives/InitiativeForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import type { VisibilityScopeValue } from "@/components/admin/shared/VisibilityScopeSelect";

type PageProps = { params: Promise<{ slug: string }> };

export default async function EditInitiativePage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { slug } = await params;
  const actor = buildActorContext(session.user);
  const initiative = await getInitiativeBySlug(slug, actor);

  if (!initiative) notFound();

  function parseStringArray(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((v): v is string => typeof v === "string");
  }

  const defaultValues = {
    title: initiative.title,
    summary: initiative.summary ?? "",
    description: initiative.description ?? "",
    status: initiative.status,
    owner: initiative.owner ?? "",
    progress: initiative.progress != null ? String(initiative.progress) : "",
    dueDate: initiative.dueDate ? new Date(initiative.dueDate).toISOString().slice(0, 10) : "",
    visibilityScope: initiative.visibilityScope as VisibilityScopeValue,
    visibleRoleRefs: parseStringArray(initiative.visibleRoleRefs),
    visibleUserRefs: parseStringArray(initiative.visibleUserRefs),
  };

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Initiativen"
        title="Initiative bearbeiten"
        description={`Bearbeite: ${initiative.title}`}
      />
      <InitiativeForm mode="edit" initiativeId={initiative.id} defaultValues={defaultValues} />
    </div>
  );
}
