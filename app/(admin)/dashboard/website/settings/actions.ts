"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite } from "@/lib/news/queries";
import { mergeWebsiteSettings } from "@/lib/website/website-settings";

async function requireWebsite() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const keys = session.user.permissionKeys ?? [];
  if (
    !keys.includes(PERMISSIONS.NEWS_MANAGE) &&
    !keys.includes(PERMISSIONS.WEBSITE_MANAGE)
  ) {
    redirect("/dashboard");
  }
  return session;
}

function str(fd: FormData, key: string): string {
  return ((fd.get(key) as string | null) ?? "").trim();
}

export async function saveWebsiteSettingsAction(formData: FormData) {
  await requireWebsite();

  const site = await getDefaultSite();
  if (!site) redirect("/dashboard/website/settings?status=no-site");

  const fullSite = await prisma.websiteSite.findUnique({
    where: { id: site.id },
    select: { settingsJson: true },
  });

  const contactEmail = str(formData, "contactEmail") || null;
  const inquiryNotificationEmail = str(formData, "inquiryNotificationEmail") || null;

  const newSettings = mergeWebsiteSettings(fullSite?.settingsJson, {
    inquiryNotificationEmail,
  });

  await prisma.websiteSite.update({
    where: { id: site.id },
    data: {
      contactEmail,
      settingsJson: newSettings,
    },
  });

  revalidatePath("/dashboard/website/settings");
  revalidatePath("/dashboard/website");
  revalidatePath("/dashboard/website/inquiries");
  redirect("/dashboard/website/settings?status=saved");
}
