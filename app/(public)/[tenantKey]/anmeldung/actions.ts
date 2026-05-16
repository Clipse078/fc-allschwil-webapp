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

const VALID_TYPES = new Set([
  "REGISTRATION_INTEREST",
  "SPONSOR_INTEREST",
  "TRAINER_INTEREST",
  "VOLUNTEER_INTEREST",
]);

async function resolveSiteId(tenantKey: string): Promise<string | null> {
  if (!tenantKey) return null;
  const site = await prisma.websiteSite.findUnique({
    where: { tenantKey, isActive: true },
    select: { id: true },
  });
  return site?.id ?? null;
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

  const siteId = await resolveSiteId(tenantKey);
  if (!siteId) {
    redirect(`/${tenantKey}/anmeldung?status=sent&type=${type}`);
  }

  await prisma.websiteInquiry.create({
    data: {
      siteId,
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

  redirect(`/${tenantKey}/anmeldung?status=sent&type=${type}`);
}
