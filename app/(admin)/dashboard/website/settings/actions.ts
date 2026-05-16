"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";

const SITE_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";

async function requireAccess() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(session.user.permissionKeys ?? []).includes(PERMISSIONS.WEBSITE_MANAGE)) {
    redirect("/dashboard/website?status=forbidden");
  }
  return session;
}

export type SettingsResult =
  | { ok: true }
  | { ok: false; error: string };

export async function updateSiteSettings(formData: FormData): Promise<SettingsResult> {
  await requireAccess();

  const name = String(formData.get("name") ?? "").trim();
  const locale = String(formData.get("locale") ?? "de").trim() || "de";
  const sport = String(formData.get("sport") ?? "football").trim() || "football";
  const domain = String(formData.get("domain") ?? "").trim() || null;
  const logoUrl = String(formData.get("logoUrl") ?? "").trim() || null;
  const primaryColor = String(formData.get("primaryColor") ?? "").trim() || null;
  const footerText = String(formData.get("footerText") ?? "").trim() || null;
  const websitePresetKey = String(formData.get("websitePresetKey") ?? "").trim() || null;
  const infoboardPresetKey = String(formData.get("infoboardPresetKey") ?? "").trim() || null;
  const infoboardMode = String(formData.get("infoboardMode") ?? "").trim() || null;

  if (!name) return { ok: false, error: "Name ist erforderlich." };

  const site = await prisma.websiteSite.findUnique({
    where: { tenantKey: SITE_TENANT_KEY },
    select: { id: true },
  });

  if (!site) {
    await prisma.websiteSite.create({
      data: {
        tenantKey: SITE_TENANT_KEY,
        name,
        locale,
        sport,
        domain,
        settingsJson: { logoUrl, primaryColor, footerText, websitePresetKey, infoboardPresetKey, infoboardMode },
      },
    });
  } else {
    await prisma.websiteSite.update({
      where: { id: site.id },
      data: {
        name,
        locale,
        sport,
        domain,
        settingsJson: { logoUrl, primaryColor, footerText, websitePresetKey, infoboardPresetKey, infoboardMode },
      },
    });
  }

  revalidatePath("/dashboard/website/settings");
  revalidatePath("/dashboard/website");
  return { ok: true };
}
