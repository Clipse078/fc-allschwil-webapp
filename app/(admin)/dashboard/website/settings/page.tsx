import { Bell, CheckCircle, XCircle } from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { getDefaultSite } from "@/lib/news/queries";
import { parseWebsiteSettings } from "@/lib/website/website-settings";
import { hasEmailProvider, getActiveProviderName } from "@/lib/website/inquiry-notifications";
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
  const providerActive = hasEmailProvider();
  const providerName = getActiveProviderName();

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
              Notifications help clubs answer website inquiries faster.
            </span>{" "}
            Lege eine Benachrichtigungs-E-Mail fest, damit neue Anfragen sofort
            die richtige Person im Verein erreichen.
          </p>
        </div>
      </AdminSurfaceCard>

      <AdminSurfaceCard className="p-5">
        <h3 className="mb-4 fca-subheading">Provider-Status</h3>
        <div className="flex items-center gap-3">
          {providerActive ? (
            <>
              <CheckCircle className="h-5 w-5 shrink-0 text-green-500" />
              <div>
                <p className="text-sm font-semibold text-slate-900">
                  E-Mail-Provider aktiv: {providerName}
                </p>
                <p className="text-xs text-slate-500">
                  Benachrichtigungen werden gesendet, sobald eine E-Mail-Adresse
                  hinterlegt ist.
                </p>
              </div>
            </>
          ) : (
            <>
              <XCircle className="h-5 w-5 shrink-0 text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-600">
                  Kein E-Mail-Provider konfiguriert
                </p>
                <p className="text-xs text-slate-400">
                  Setze{" "}
                  <code className="rounded bg-slate-100 px-1 text-[11px]">RESEND_API_KEY</code>
                  {" "}oder{" "}
                  <code className="rounded bg-slate-100 px-1 text-[11px]">SMTP_HOST</code>
                  {" "}um E-Mail-Versand zu aktivieren. Anfragen werden weiterhin gespeichert.
                </p>
              </div>
            </>
          )}
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
