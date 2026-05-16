"use server";

import { DomainStatus, Prisma, SslStatus } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { isSuperAdmin } from "@/lib/permissions/is-super-admin";

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
  const infoboardDisplayOptionsRaw = String(formData.get("infoboardDisplayOptions") ?? "").trim();
  let infoboardDisplayOptions: Record<string, unknown> | null = null;
  try { infoboardDisplayOptions = infoboardDisplayOptionsRaw ? JSON.parse(infoboardDisplayOptionsRaw) : null; } catch { /* ignore */ }

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
        settingsJson: { logoUrl, primaryColor, footerText, websitePresetKey, infoboardPresetKey, infoboardMode, infoboardDisplayOptions } as Prisma.InputJsonValue,
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
        settingsJson: { logoUrl, primaryColor, footerText, websitePresetKey, infoboardPresetKey, infoboardMode, infoboardDisplayOptions } as Prisma.InputJsonValue,
      },
    });
  }

  revalidatePath("/dashboard/website/settings");
  revalidatePath("/dashboard/website");
  return { ok: true };
}

// ── Domain management ─────────────────────────────────────────────────────────

export type DomainResult = { ok: true } | { ok: false; error: string };

export async function updateDomainSettings(formData: FormData): Promise<DomainResult> {
  await requireAccess();

  const domain = String(formData.get("domain") ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "") || null;
  const apexDomain = String(formData.get("apexDomain") ?? "").trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "") || null;

  const site = await prisma.websiteSite.findUnique({
    where: { tenantKey: SITE_TENANT_KEY },
    select: { id: true, domain: true },
  });

  if (!site) return { ok: false, error: "Website-Site nicht gefunden." };

  // Unique domain check (only if domain changed)
  if (domain && domain !== site.domain) {
    const taken = await prisma.websiteSite.findUnique({
      where: { domain },
      select: { id: true },
    });
    if (taken && taken.id !== site.id) {
      return { ok: false, error: `Domain «${domain}» ist bereits von einem anderen Tenant belegt.` };
    }
  }

  // Reset to DNS_PENDING when domain changes
  const domainChanged = domain !== site.domain;

  await prisma.websiteSite.update({
    where: { id: site.id },
    data: {
      domain,
      apexDomain,
      ...(domainChanged ? { domainStatus: "DNS_PENDING", sslStatus: "UNKNOWN" } : {}),
    },
  });

  revalidatePath("/dashboard/website/settings");
  return { ok: true };
}

export async function superadminVerifyDomain(formData: FormData): Promise<DomainResult> {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!isSuperAdmin(session)) return { ok: false, error: "Superadmin-Zugriff erforderlich." };

  const siteId = String(formData.get("siteId") ?? "").trim();
  const newStatus = String(formData.get("domainStatus") ?? "VERIFIED").trim() as DomainStatus;
  const newSsl = String(formData.get("sslStatus") ?? "ACTIVE").trim() as SslStatus;

  const validStatuses = Object.values(DomainStatus) as string[];
  const validSsl = Object.values(SslStatus) as string[];

  if (!siteId || !validStatuses.includes(newStatus) || !validSsl.includes(newSsl)) {
    return { ok: false, error: "Ungültige Statuswerte." };
  }

  await prisma.websiteSite.update({
    where: { id: siteId },
    data: { domainStatus: newStatus, sslStatus: newSsl },
  });

  revalidatePath("/dashboard/website/settings");
  return { ok: true };
}
