import type React from "react";
import Link from "next/link";
import { Globe, ImageIcon, Newspaper, Users, Users2, Zap } from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getDefaultSite } from "@/lib/news/queries";

const NUDGES = [
  {
    icon: Newspaper,
    title: "Websites with current news feel significantly more active.",
    body: "Veröffentliche regelmässig Artikel – das steigert die Wahrnehmung des Vereins im Netz.",
    href: "/dashboard/website/news",
    cta: "News verwalten",
  },
  {
    icon: Users,
    title: "Sponsor pages help clubs present commercial partnerships professionally.",
    body: "Präsentiere Sponsoren strukturiert auf der Website und stärke die Aussenwirkung.",
    href: "/dashboard/website/sponsoren",
    cta: "Sponsoren verwalten",
  },
  {
    icon: Zap,
    title: "Consistent branding improves club recognition.",
    body: "Logo, Farbe und Tagline können pro Website-Eintrag (WebsiteSite) hinterlegt werden.",
    href: null,
    cta: null,
  },
];

type WebsiteModule = {
  title: string;
  description: string;
  href: string | null;
  icon: React.ComponentType<{ className?: string }>;
  soon?: boolean;
};

const MODULES: WebsiteModule[] = [
  {
    title: "News & Artikel",
    description: "Beiträge erstellen, redigieren und auf der öffentlichen Website publizieren.",
    href: "/dashboard/website/news",
    icon: Newspaper,
  },
  {
    title: "Sponsoren",
    description: "Partner verwalten und Sichtbarkeit für Website, Infoboard und Sponsor-Strip steuern.",
    href: "/dashboard/website/sponsoren",
    icon: Users,
  },
  {
    title: "Teams (Public)",
    description: "Öffentliche Team-Seiten werden automatisch aus den Stammdaten generiert. Sichtbarkeit via Team-Einstellungen steuern.",
    href: "/dashboard/teams",
    icon: Users2,
  },
  {
    title: "Mediathek",
    description: "Bilder und Medien für die Website zentral verwalten. CDN-ready, upload-bereit.",
    href: "/dashboard/website/media",
    icon: ImageIcon,
  },
];

export default async function WebsiteOverviewPage() {
  await requirePermission(PERMISSIONS.NEWS_MANAGE);

  const site = await getDefaultSite();

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Website"
        title="Website & Content"
        description="Manage public-facing content for the club website. News, sponsors, pages and branding all live here."
      />

      {!site && (
        <AdminSurfaceCard className="border-amber-200 bg-amber-50 p-5">
          <div className="flex items-start gap-3">
            <Globe className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
            <p className="text-sm text-amber-800">
              Kein aktiver Website-Eintrag gefunden.{" "}
              Eine{" "}
              <code className="rounded bg-amber-100 px-1 text-xs">WebsiteSite</code>
              {" "}Zeile mit{" "}
              <code className="rounded bg-amber-100 px-1 text-xs">isActive = true</code>
              {" "}muss in der Datenbank existieren, bevor Inhalte erstellt werden können.
            </p>
          </div>
        </AdminSurfaceCard>
      )}

      <AdminSurfaceCard className="p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            const inner = (
              <div className="flex items-start gap-4">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-[#0b4aa2] shadow-sm">
                  <Icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900">
                    {mod.title}
                    {mod.soon && (
                      <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                        Bald
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{mod.description}</p>
                </div>
              </div>
            );

            if (mod.href) {
              return (
                <Link
                  key={mod.title}
                  href={mod.href}
                  className="block rounded-[20px] border border-slate-200 p-5 transition hover:border-blue-200 hover:bg-blue-50/40"
                >
                  {inner}
                </Link>
              );
            }
            return (
              <div
                key={mod.title}
                className="rounded-[20px] border border-slate-100 bg-slate-50/60 p-5 opacity-60"
              >
                {inner}
              </div>
            );
          })}
        </div>
      </AdminSurfaceCard>

      <div className="space-y-3">
        <p className="fca-eyebrow px-1">Website-Readiness</p>
        {NUDGES.map((nudge) => {
          const Icon = nudge.icon;
          return (
            <AdminSurfaceCard
              key={nudge.title}
              className="flex items-start gap-4 p-5"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-blue-600">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{nudge.title}</p>
                <p className="mt-1 text-sm text-slate-500">{nudge.body}</p>
              </div>
              {nudge.href && nudge.cta && (
                <Link
                  href={nudge.href}
                  className="shrink-0 text-sm font-medium text-blue-600 hover:underline"
                >
                  {nudge.cta} →
                </Link>
              )}
            </AdminSurfaceCard>
          );
        })}
      </div>
    </div>
  );
}
