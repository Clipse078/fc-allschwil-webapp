"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";
import { notifyWebsiteInquiryCreated } from "@/lib/website/inquiry-notifications";
import { getInquiryNotificationEmail } from "@/lib/website/website-settings";

function str(fd: FormData, key: string): string {
  return ((fd.get(key) as string | null) ?? "").trim();
}

function nullable(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v || null;
}

async function resolveSite(tenantKey: string) {
  if (!tenantKey) return null;
  return prisma.websiteSite.findUnique({
    where: { tenantKey, isActive: true },
    select: { id: true, contactEmail: true, settingsJson: true },
  });
}

export async function submitContactInquiryAction(formData: FormData) {
  const tenantKey = str(formData, "tenantKey");
  const honeypot = str(formData, "website_url");

  // Silently ignore spam
  if (honeypot) {
    redirect(`/${tenantKey}/kontakt?status=sent`);
  }

  const name = str(formData, "name");
  const email = str(formData, "email");
  const message = str(formData, "message");

  if (!name || !email || !message) {
    redirect(`/${tenantKey}/kontakt?status=error`);
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    redirect(`/${tenantKey}/kontakt?status=error`);
  }

  const site = await resolveSite(tenantKey);
  if (!site) {
    redirect(`/${tenantKey}/kontakt?status=sent`);
  }

  const inquiry = await prisma.websiteInquiry.create({
    data: {
      siteId: site.id,
      type: "CONTACT",
      status: "NEW",
      name,
      email,
      phone: nullable(formData, "phone"),
      topic: nullable(formData, "topic"),
      message,
      sourcePath: `/${tenantKey}/kontakt`,
    },
  });

  try {
    const recipientEmail = getInquiryNotificationEmail(site.settingsJson, site.contactEmail);
    await notifyWebsiteInquiryCreated(
      { id: inquiry.id, type: inquiry.type, name, email,
        phone: inquiry.phone, topic: inquiry.topic, message,
        sourcePath: inquiry.sourcePath },
      recipientEmail
    );
  } catch (err) {
    console.error("[inquiry-notification] Contact notification failed:", err);
  }

  redirect(`/${tenantKey}/kontakt?status=sent`);
}
