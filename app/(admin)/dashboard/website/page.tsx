import Link from "next/link";
import {
  FileText,
  Globe,
  ImageIcon,
  Layers,
  Newspaper,
  Settings2,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
} from "@/components/ui/page";

type ModuleCardProps = {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
};

function ModuleCard({ href, icon, title, description }: ModuleCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:border-[var(--tenant-primary)] hover:shadow-md"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--surface-2)] text-[var(--muted)] transition group-hover:bg-[var(--tenant-primary)] group-hover:text-white">
        {icon}
      </div>
      <div>
        <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">{title}</p>
        <p className="mt-0.5 text-[0.8125rem] text-[var(--muted)]">{description}</p>
      </div>
    </Link>
  );
}

export default async function WebsiteOverviewPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
  ]);

  const canManage = hasPermission(session, PERMISSIONS.WEBSITE_MANAGE);

  return (
    <PageShell>
      <PageBreadcrumbs
        items={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Website" },
        ]}
      />
      <PageHeader
        eyebrow="Website"
        title="Website-Verwaltung"
        description="Inhalte erstellen, Seiten verwalten und Veröffentlichungen steuern."
      />

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ModuleCard
          href="/dashboard/website/news"
          icon={<Newspaper className="h-5 w-5" />}
          title="News"
          description="Newsartikel erstellen, prüfen und veröffentlichen."
        />
        <ModuleCard
          href="/dashboard/website/publishing"
          icon={<Layers className="h-5 w-5" />}
          title="Veröffentlichungen"
          description="Inhalte prüfen, freigeben, planen und publizieren."
        />
        <ModuleCard
          href="/dashboard/website/media"
          icon={<ImageIcon className="h-5 w-5" />}
          title="Mediathek"
          description="Bilder und Videos hochladen und verwalten."
        />
        {canManage && (
          <>
            <ModuleCard
              href="/dashboard/website/pages"
              icon={<FileText className="h-5 w-5" />}
              title="Seiten"
              description="Statische Website-Seiten erstellen und bearbeiten."
            />
            <ModuleCard
              href="/dashboard/website/settings"
              icon={<Settings2 className="h-5 w-5" />}
              title="Einstellungen"
              description="Website-Konfiguration und Veröffentlichungsmodus."
            />
          </>
        )}
      </div>

      <div className="mt-8 flex items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
        <Globe className="h-5 w-5 shrink-0 text-[var(--muted)]" />
        <p className="text-[0.8125rem] text-[var(--muted)]">
          Wähle einen Bereich, um mit der Arbeit zu beginnen.
          {canManage
            ? " Als Website-Manager hast du Zugriff auf alle Bereiche."
            : " Du hast Zugriff auf News, Medien und Veröffentlichungen."}
        </p>
      </div>
    </PageShell>
  );
}
