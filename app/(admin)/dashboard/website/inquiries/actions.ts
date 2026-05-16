"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite } from "@/lib/news/queries";

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

async function updateStatus(
  inquiryId: string,
  newStatus: "IN_PROGRESS" | "RESOLVED" | "ARCHIVED"
) {
  const site = await getDefaultSite();
  if (!site) return;

  const inquiry = await prisma.websiteInquiry.findFirst({
    where: { id: inquiryId, siteId: site.id },
    select: { id: true },
  });
  if (!inquiry) return;

  await prisma.websiteInquiry.update({
    where: { id: inquiryId },
    data: { status: newStatus },
  });

  revalidatePath("/dashboard/website/inquiries");
}

export async function markInProgressAction(formData: FormData) {
  await requireWebsite();
  await updateStatus(str(formData, "inquiryId"), "IN_PROGRESS");
  redirect("/dashboard/website/inquiries?status=updated");
}

export async function markResolvedAction(formData: FormData) {
  await requireWebsite();
  await updateStatus(str(formData, "inquiryId"), "RESOLVED");
  redirect("/dashboard/website/inquiries?status=updated");
}

export async function archiveInquiryAction(formData: FormData) {
  await requireWebsite();
  await updateStatus(str(formData, "inquiryId"), "ARCHIVED");
  redirect("/dashboard/website/inquiries?status=updated");
}
