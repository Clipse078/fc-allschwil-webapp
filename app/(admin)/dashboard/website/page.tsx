/**
 * Website Management overview — /dashboard/website
 *
 * Single source of truth: section cards are derived from the website item's
 * children in lib/nav/nav-config.ts (labels, hrefs, permissionKeys,
 * descriptions). No route, label, or permission is hardcoded here.
 *
 * Icons are the only page-local concern: they are presentation-only and
 * mapped by nav child key so they stay decoupled from nav config.
 *
 * Permission gate: NEWS_MANAGE (content) | WEBSITE_MANAGE (full)
 * Tenant isolation: resolved from session.user.tenantId via requireAnyPermission
 */

import Link from "next/link";
import type { ElementType } from "react";
import {
  FileText,
  Globe,
  ImageIcon,
  Layers,
  Newspaper,
  Settings2,
} from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS, type PermissionKey } from "@/lib/permissions/permissions";
import { NAV_SECTIONS, type NavItemChild } from "@/lib/nav/nav-config";
import {
  PageShell,
  PageBreadcrumbs,
  PageHeader,
} from "@/components/ui/page";

// ── Icon map — presentation only, keyed by NavItemChild.key ──────────────────
// Icons are not part of nav-config (sidebar resolves them by label via
// getNavIcon). Keeping them here avoids importing lucide into nav-config.

const SECTION_ICONS: Record<string, ElementType> = {
  "website-news":        Newspaper,
  "website-pages":       FileText,
  "website-media":       ImageIcon,
  "website-publishing":  Layers,
  "website-settings":    Settings2,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/** True if the user holds at least one of the required permission keys. */
function userHasAccess(
  userKeys: string[],
  required?: PermissionKey[],
): boolean {
  if (!required || required.length === 0) return true;
  return required.some((k) => userKeys.includes(k));
}

/** Returns the website item's children filtered to what the user can access. */
function getVisibleWebsiteChildren(userKeys: string[]): NavItemChild[] {
  const websiteItem = NAV_SECTIONS
    .flatMap((s) => s.items)
    .find((item) => item.key === "website");

  return (websiteItem?.children ?? []).filter((child) =>
    userHasAccess(userKeys, child.permissionKeys),
  );
}

// ── Card component ────────────────────────────────────────────────────────────

type ModuleCardProps = {
  href: string;
  icon: React.ReactNode;
  label: string;
  description: string;
};

function ModuleCard({ href, icon, label, description }: ModuleCardProps) {
  return (
    <Link
      href={href}
      className="group flex flex-col gap-3 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm transition hover:border-[var(--tenant-primary)] hover:shadow-md"
    >
      <div className="flex h-10 w-10 items-center justify-center rounded-[10px] bg-[var(--surface-2)] text-[var(--muted)] transition group-hover:bg-[var(--tenant-primary)] group-hover:text-white">
        {icon}
      </div>
      <div>
        <p className="text-[0.9375rem] font-semibold text-[var(--foreground)]">{label}</p>
        <p className="mt-0.5 text-[0.8125rem] text-[var(--muted)]">{description}</p>
      </div>
    </Link>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function WebsiteOverviewPage() {
  const session = await requireAnyPermission([
    PERMISSIONS.NEWS_MANAGE,
    PERMISSIONS.WEBSITE_MANAGE,
  ]);

  const userKeys = session.user.permissionKeys;
  const visibleChildren = getVisibleWebsiteChildren(userKeys);
  const hasFullAccess = userKeys.includes(PERMISSIONS.WEBSITE_MANAGE);

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
        {visibleChildren.map((child) => {
          const Icon = SECTION_ICONS[child.key];
          if (!Icon) return null;
          return (
            <ModuleCard
              key={child.key}
              href={child.href}
              icon={<Icon className="h-5 w-5" />}
              label={child.label}
              description={child.description ?? ""}
            />
          );
        })}
      </div>

      <div className="mt-8 flex items-center gap-3 rounded-[var(--radius-xl)] border border-[var(--border)] bg-[var(--surface-2)] px-5 py-4">
        <Globe className="h-5 w-5 shrink-0 text-[var(--muted)]" />
        <p className="text-[0.8125rem] text-[var(--muted)]">
          Wähle einen Bereich, um mit der Arbeit zu beginnen.
          {hasFullAccess
            ? " Als Website-Manager hast du Zugriff auf alle Bereiche."
            : " Du hast Zugriff auf News, Medien und Veröffentlichungen."}
        </p>
      </div>
    </PageShell>
  );
}
