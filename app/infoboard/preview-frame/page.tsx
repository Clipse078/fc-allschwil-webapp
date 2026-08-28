import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { InfoboardAnlageplan } from "@/components/infoboard/anlageplan/InfoboardAnlageplan";
import {
  PreviewFrameScreen1,
  PreviewFrameScreen2,
  PreviewFrameStatic,
} from "@/components/infoboard/preview/PreviewFrame";
import {
  buildScreen1PreviewData,
  buildScreen2PreviewData,
} from "@/lib/infoboard/preview-data";
import { parseInfoboardPreviewMoment } from "@/lib/infoboard/preview-time";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";

export const metadata: Metadata = {
  title: "Infoboard Vorschau",
  robots: { index: false, follow: false },
};

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function first(value: string | string[] | undefined) {
  return typeof value === "string" ? value : undefined;
}

export default async function InfoboardPreviewFramePage({
  searchParams,
}: PageProps) {
  await requireAnyPermission([
    PERMISSIONS.INFOBOARD_MANAGE,
    PERMISSIONS.EVENTS_PUBLISH_INFOBOARD,
  ]);
  const tenant = await getActiveTenant();
  if (!tenant?.timezone) notFound();
  const previewTenant = { ...tenant, timezone: tenant.timezone };

  const params = await searchParams;
  const preview = parseInfoboardPreviewMoment(
    {
      screen: first(params.screen),
      date: first(params.date),
      time: first(params.time),
    },
    tenant.timezone,
  );

  if (preview.screen === "1") {
    const { payload, weather } = await buildScreen1PreviewData(
      previewTenant,
      preview.now,
    );
    return (
      <PreviewFrameScreen1
        feed={payload.feed}
        branding={payload.branding}
        currentTimeIso={payload.currentTimeIso}
        weather={weather}
        announcement={payload.announcement ?? undefined}
        eventPresentation={payload.eventPresentation}
        theme={payload.theme}
        headerConfig={payload.headerConfig ?? undefined}
        presentation={payload.presentation ?? undefined}
        studio={payload.studio ?? undefined}
        autoRotate={first(params.auto) === "1"}
      />
    );
  }

  const data = await buildScreen2PreviewData(previewTenant, preview.now);
  if (data.renderer === "anlageplan") {
    return (
      <PreviewFrameStatic>
        <InfoboardAnlageplan
          payload={data.payload}
          weather={data.weather}
          shellConfig={data.shellConfig}
          branding={data.branding}
          liveClock={false}
        />
      </PreviewFrameStatic>
    );
  }

  return (
    <PreviewFrameScreen2
      feed={data.payload.feed}
      branding={data.payload.branding}
      currentTimeIso={data.payload.currentTimeIso}
      weather={data.weather}
      theme={data.payload.theme}
    />
  );
}
