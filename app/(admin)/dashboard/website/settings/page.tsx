import { Bell } from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { getDefaultSite } from "@/lib/news/queries";
import { parseWebsiteSettings } from "@/lib/website/website-settings";
import { saveWebsiteSettingsAction } from "./actions";

type SettingsPageProps = {
  searchParams?: Promise<{ status?: string }>;
};

const inputCls =
  "w-full rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export default async function WebsiteSettingsPage({ searchParams }: SettingsPageProps) {
  await requireAnyPermission([
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
  ]);

  const params = (await searchParams) ?? {};
  const saved = params.status === "saved";

  const site = await getDefaultSite();
  const fullSite = site
    ? await prisma.websiteSite.findUnique({
        where: { id: site.id },
        select: {
          contactEmail: true,
          settingsJson: true,
          tenantKey: true,
          name: true,
        },
      })
    : null;

  const settings = parseWebsiteSettings(fullSite?.settingsJson);
  const currentNotificationEmail = settings.inquiryNotificationEmail ?? "";
  const currentContactEmail = fullSite?.contactEmail ?? "";

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Website · Einstellungen"
        title="Website-Einstellungen"
        description="Konfiguriere Benachrichtigungen, Kontakt-E-Mails und weitere Website-Einstellungen."
      />

      <AdminSurfaceCard className="border-blue-100 bg-blue-50/60 p-5">
        <div className="flex items-start gap-3">
          <Bell className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
          <p className="text-sm text-slate-700">
            <span className="font-semibold">
              Lege eine Benachrichtigungs-E-Mail fest, damit neue Anfragen sofort
              die richtige Person im Verein erreichen.
            </span>{" "}
            Ohne E-Mail-Adresse werden Anfragen nur in der Inbox gespeichert.
          </p>
        </div>
      </AdminSurfaceCard>

      {saved && (
        <AdminSurfaceCard className="border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-800">
            Einstellungen gespeichert.
          </p>
        </AdminSurfaceCard>
      )}

      {!site && (
        <AdminSurfaceCard className="border-amber-200 bg-amber-50 p-5">
          <p className="text-sm text-amber-800">
            Kein aktiver Website-Eintrag gefunden.
          </p>
        </AdminSurfaceCard>
      )}

      {site && (
        <form action={saveWebsiteSettingsAction} className="space-y-5">
          <AdminSurfaceCard className="space-y-5 p-6">
            <h3 className="fca-subheading">Anfragen-Benachrichtigungen</h3>

            <label className="block space-y-2">
              <span className="fca-label">Benachrichtigungs-E-Mail</span>
              <input
                type="email"
                name="inquiryNotificationEmail"
                defaultValue={currentNotificationEmail}
                placeholder="info@verein.ch"
                className={inputCls}
              />
              <p className="text-xs text-slate-400">
                An diese Adresse wird eine Benachrichtigung gesendet, sobald eine neue
                Website-Anfrage eingeht. Erfordert einen konfigurierten E-Mail-Provider
                (RESEND_API_KEY oder SMTP_HOST).
              </p>
            </label>
          </AdminSurfaceCard>

          <AdminSurfaceCard className="space-y-5 p-6">
            <h3 className="fca-subheading">Kontakt</h3>

            <label className="block space-y-2">
              <span className="fca-label">Allgemeine Kontakt-E-Mail</span>
              <input
                type="email"
                name="contactEmail"
                defaultValue={currentContactEmail}
                placeholder="info@verein.ch"
                className={inputCls}
              />
              <p className="text-xs text-slate-400">
                Wird als Fallback-Empfänger für Benachrichtigungen verwendet und
                erscheint zukünftig auf der öffentlichen Kontaktseite.
              </p>
            </label>
          </AdminSurfaceCard>

          <div className="flex justify-end">
            <button type="submit" className="fca-button-primary">
              Einstellungen speichern
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
