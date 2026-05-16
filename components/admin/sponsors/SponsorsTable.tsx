"use client";

import Link from "next/link";
import AdminListItem from "@/components/admin/shared/AdminListItem";
import AdminStatusPill from "@/components/admin/shared/AdminStatusPill";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import type { SponsorListItem } from "@/lib/website/sponsor-queries";

type SponsorsTableProps = {
  sponsors: SponsorListItem[];
};

export default function SponsorsTable({ sponsors }: SponsorsTableProps) {
  if (sponsors.length === 0) {
    return (
      <AdminSurfaceCard className="p-6">
        <p className="text-sm text-slate-500">
          Noch keine Sponsoren erfasst. Erstelle den ersten Sponsor.
        </p>
      </AdminSurfaceCard>
    );
  }

  return (
    <div className="space-y-3">
      {sponsors.map((sponsor) => (
        <AdminListItem
          key={sponsor.id}
          avatar={
            sponsor.logoUrl ? (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-slate-200 bg-white p-1 shadow-sm">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={sponsor.logoUrl}
                  alt={sponsor.name}
                  className="max-h-full max-w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-gradient-to-br from-white to-slate-100 font-[var(--font-display)] text-[10px] font-bold uppercase tracking-wide text-[#0b4aa2] shadow-sm">
                {sponsor.name.slice(0, 3)}
              </div>
            )
          }
          title={sponsor.name}
          subtitle={
            [
              sponsor.tier ?? null,
              sponsor.websiteUrl
                ? sponsor.websiteUrl.replace(/^https?:\/\//, "")
                : null,
            ]
              .filter(Boolean)
              .join(" · ") || "–"
          }
          meta={
            <>
              <AdminStatusPill
                label={sponsor.isActive ? "Aktiv" : "Inaktiv"}
                tone={sponsor.isActive ? "success" : "muted"}
              />
              {sponsor.showOnWebsite && (
                <span className="fca-pill">Website</span>
              )}
              {sponsor.showOnInfoboard && (
                <span className="fca-pill">Infoboard</span>
              )}
              {sponsor.showOnSponsorStrip && (
                <span className="fca-pill">Strip</span>
              )}
            </>
          }
          actions={
            <Link
              href={`/dashboard/website/sponsoren/${sponsor.id}`}
              className="fca-button-primary"
            >
              Bearbeiten
            </Link>
          }
        />
      ))}
    </div>
  );
}
