import { auth } from "@/auth";
import { redirect } from "next/navigation";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import TargetNewPageClient from "@/components/admin/targets/TargetNewPageClient";

export default async function NewTargetPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Ziele"
        title="Neues Ziel erstellen"
        description="Strategisches Ziel mit messbaren Metriken erfassen. Optional eine Vorlage als Ausgangspunkt verwenden."
      />
      <TargetNewPageClient />
    </div>
  );
}
