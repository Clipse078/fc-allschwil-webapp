import { notFound } from "next/navigation";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { PreviewStudio } from "@/components/infoboard/preview/PreviewStudio";
import { buildBoardConfig } from "@/lib/infoboard/board-config";
import { getInfoboardBySlug } from "@/lib/infoboard/queries";
import { parseInfoboardPreviewMoment } from "@/lib/infoboard/preview-time";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function InfoboardPreviewPage({ searchParams }: PageProps) {
  await requireAnyPermission([
    PERMISSIONS.INFOBOARD_MANAGE,
    PERMISSIONS.EVENTS_PUBLISH_INFOBOARD,
  ]);
  const tenant = await getActiveTenant();
  if (!tenant?.timezone) notFound();

  const board = await getInfoboardBySlug("screen-1", tenant.id);
  const boardConfig = board ? buildBoardConfig(board) : null;

  const params = await searchParams;
  const preview = parseInfoboardPreviewMoment(
    {
      screen: first(params.screen),
      date: first(params.date),
      time: first(params.time),
    },
    tenant.timezone,
  );

  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <AdminSectionHeader
        eyebrow="Infoboard"
        title="Vorschau"
        description="Prüfe geplante Infoboard-Zustände mit echten Mandantendaten."
      />
      <PreviewStudio
        key={`${preview.screen}:${preview.date}:${preview.time}`}
        initialScreen={preview.screen}
        initialDate={preview.date}
        initialTime={preview.time}
        timeZone={tenant.timezone}
        screen1BoardId={board?.id ?? null}
        initialStudio={boardConfig?.studio}
      />
    </div>
  );
}
