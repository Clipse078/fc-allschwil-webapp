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

const VALID_TYPES = new Set([
  "REGISTRATION_INTEREST",
  "SPONSOR_INTEREST",
  "TRAINER_INTEREST",
  "VOLUNTEER_INTEREST",
]);

async function resolveSite(tenantKey: string) {
  if (!tenantKey) return null;
  return prisma.websiteSite.findUnique({
    where: { tenantKey, isActive: true },
    select: { id: true, contactEmail: true, settingsJson: true },
  });
}

export async function submitRegistrationInterestAction(formData: FormData) {
  const tenantKey = str(formData, "tenantKey");
  const honeypot = str(formData, "website_url");
  const rawType = str(formData, "inquiryType");

  if (honeypot) {
    redirect(`/${tenantKey}/anmeldung?status=sent&type=${rawType}`);
  }

  const type = VALID_TYPES.has(rawType) ? rawType : "REGISTRATION_INTEREST";
  const name = str(formData, "name");
  const email = str(formData, "email");
  const message = str(formData, "message");

  if (!name || !email) {
    redirect(`/${tenantKey}/anmeldung?status=error&type=${type}`);
  }

  const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailPattern.test(email)) {
    redirect(`/${tenantKey}/anmeldung?status=error&type=${type}`);
  }

  const site = await resolveSite(tenantKey);
  if (!site) {
    redirect(`/${tenantKey}/anmeldung?status=sent&type=${type}`);
  }

  const inquiry = await prisma.websiteInquiry.create({
    data: {
      siteId: site.id,
      type: type as
        | "REGISTRATION_INTEREST"
        | "SPONSOR_INTEREST"
        | "TRAINER_INTEREST"
        | "VOLUNTEER_INTEREST",
      status: "NEW",
      name,
      email,
      phone: nullable(formData, "phone"),
      topic: str(formData, "topic") || null,
      message: message || `Interesse: ${type}`,
      sourcePath: `/${tenantKey}/anmeldung`,
    },
  });

  try {
    const recipientEmail = getInquiryNotificationEmail(site.settingsJson, site.contactEmail);
    await notifyWebsiteInquiryCreated(
      { id: inquiry.id, type: inquiry.type, name, email,
        phone: inquiry.phone, topic: inquiry.topic,
        message: inquiry.message, sourcePath: inquiry.sourcePath },
      recipientEmail
    );
  } catch (err) {
    console.error("[inquiry-notification] Registration notification failed:", err);
  }

  redirect(`/${tenantKey}/anmeldung?status=sent&type=${type}`);
}
