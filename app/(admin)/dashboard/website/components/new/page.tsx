import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import ReusableComponentEditor from "@/components/admin/reusable-components/ReusableComponentEditor";

export default async function NewReusableComponentPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);

  return (
    <div className="mx-auto max-w-screen-lg px-5 py-8 md:px-8 md:py-10">
      <ReusableComponentEditor mode="create" />
    </div>
  );
}
