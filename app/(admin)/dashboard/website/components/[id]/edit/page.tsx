import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getReusableComponent } from "@/lib/reusable-components/queries";
import ReusableComponentEditor from "@/components/admin/reusable-components/ReusableComponentEditor";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditReusableComponentPage({ params }: PageProps) {
  const session = await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  const tenantId = session.user?.activeTenantId;
  if (!tenantId) notFound();

  const { id } = await params;
  const component = await getReusableComponent(tenantId, id);
  if (!component) notFound();

  return (
    <div className="mx-auto max-w-screen-lg px-5 py-8 md:px-8 md:py-10">
      <ReusableComponentEditor mode="edit" initialData={component} />
    </div>
  );
}
