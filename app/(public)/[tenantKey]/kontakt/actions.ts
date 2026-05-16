"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db/prisma";

function str(fd: FormData, key: string): string {
  return ((fd.get(key) as string | null) ?? "").trim();
}

function nullable(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v || null;
}

async function resolveSiteId(tenantKey: string): Promise<string | null> {
  if (!tenantKey) return null;
  const site = await prisma.websiteSite.findUnique({
    where: { tenantKey, isActive: true },
    select: { id: true },
  });
  return site?.id ?? null;
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

  const siteId = await resolveSiteId(tenantKey);
  if (!siteId) {
    redirect(`/${tenantKey}/kontakt?status=sent`);
  }

  await prisma.websiteInquiry.create({
    data: {
      siteId,
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

  redirect(`/${tenantKey}/kontakt?status=sent`);
}
