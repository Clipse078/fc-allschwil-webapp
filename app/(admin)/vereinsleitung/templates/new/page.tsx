import { auth } from "@/auth";
import { redirect } from "next/navigation";
import TemplateForm from "@/components/admin/templates/TemplateForm";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";

export default async function NewTemplatePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  return (
    <div className="space-y-6">
      <AdminSectionHeader eyebrow="Kommunikation" title="Neue Vorlage" description="Erstelle eine kontextbewusste Kommunikationsvorlage mit Variablen." />
      <TemplateForm mode="create" />
    </div>
  );
}
