"use client";

import { useState } from "react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import type { SponsorDetailData } from "@/lib/website/sponsor-queries";

const inputCls =
  "w-full rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

function Toggle({
  name,
  label,
  description,
  defaultChecked,
}: {
  name: string;
  label: string;
  description?: string;
  defaultChecked: boolean;
}) {
  const [checked, setChecked] = useState(defaultChecked);
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="min-w-0">
        <p className="text-sm font-medium text-slate-800">{label}</p>
        {description && (
          <p className="mt-0.5 text-xs text-slate-500">{description}</p>
        )}
      </div>
      <input type="hidden" name={name} value={checked ? "1" : "0"} />
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => setChecked((v) => !v)}
        className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 ${
          checked ? "bg-[#0b4aa2]" : "bg-slate-200"
        }`}
      >
        <span
          className={`pointer-events-none block h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? "translate-x-[22px]" : "translate-x-0.5"
          } mt-0.5`}
        />
      </button>
    </div>
  );
}

type SponsorFormCardProps = {
  mode: "create" | "edit";
  action: (formData: FormData) => Promise<void>;
  sponsor?: SponsorDetailData;
};

export default function SponsorFormCard({
  mode,
  action,
  sponsor,
}: SponsorFormCardProps) {
  const [logoUrl, setLogoUrl] = useState(sponsor?.logoUrl ?? "");

  return (
    <form action={action} className="space-y-5">
      {mode === "edit" && sponsor && (
        <input type="hidden" name="sponsorId" value={sponsor.id} />
      )}

      <AdminSurfaceCard className="space-y-5 p-6">
        <h3 className="fca-subheading">Stammdaten</h3>

        <label className="block space-y-2">
          <span className="fca-label">Name *</span>
          <input
            type="text"
            name="name"
            defaultValue={sponsor?.name ?? ""}
            required
            placeholder="Muster AG"
            className={inputCls}
          />
        </label>

        <label className="block space-y-2">
          <span className="fca-label">Tier / Kategorie</span>
          <input
            type="text"
            name="tier"
            defaultValue={sponsor?.tier ?? ""}
            placeholder="z. B. Hauptsponsor, Gold, Partner …"
            className={inputCls}
          />
          <p className="text-xs text-slate-400">
            Wird für die Gruppierung auf der Website verwendet.
          </p>
        </label>

        <div className="grid gap-5 sm:grid-cols-2">
          <label className="block space-y-2">
            <span className="fca-label">Sortierung</span>
            <input
              type="number"
              name="sortOrder"
              defaultValue={sponsor?.sortOrder ?? 0}
              min={0}
              className={inputCls}
            />
            <p className="text-xs text-slate-400">Kleinere Zahlen erscheinen zuerst.</p>
          </label>
        </div>
      </AdminSurfaceCard>

      <AdminSurfaceCard className="space-y-5 p-6">
        <h3 className="fca-subheading">Links & Logo</h3>

        <label className="block space-y-2">
          <span className="fca-label">Logo-URL</span>
          <input
            type="url"
            name="logoUrl"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://…"
            className={inputCls}
          />
          {logoUrl && (
            <div className="mt-2 flex h-16 w-32 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={logoUrl}
                alt="Logo-Vorschau"
                className="max-h-full max-w-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
        </label>

        <label className="block space-y-2">
          <span className="fca-label">Website</span>
          <input
            type="url"
            name="websiteUrl"
            defaultValue={sponsor?.websiteUrl ?? ""}
            placeholder="https://…"
            className={inputCls}
          />
        </label>
      </AdminSurfaceCard>

      <AdminSurfaceCard className="space-y-4 p-6">
        <h3 className="fca-subheading">Sichtbarkeit</h3>

        <Toggle
          name="isActive"
          label="Aktiv"
          description="Inaktive Sponsoren erscheinen nirgends."
          defaultChecked={sponsor?.isActive ?? true}
        />
        <div className="my-1 border-t border-slate-100" />
        <Toggle
          name="showOnWebsite"
          label="Website anzeigen"
          description="Erscheint auf der öffentlichen Sponsoren-Seite."
          defaultChecked={sponsor?.showOnWebsite ?? true}
        />
        <Toggle
          name="showOnInfoboard"
          label="Infoboard anzeigen"
          description="Erscheint auf dem digitalen Infoboard."
          defaultChecked={sponsor?.showOnInfoboard ?? false}
        />
        <Toggle
          name="showOnSponsorStrip"
          label="Sponsor-Strip anzeigen"
          description="Erscheint im umlaufenden Sponsor-Banner."
          defaultChecked={sponsor?.showOnSponsorStrip ?? false}
        />
      </AdminSurfaceCard>

      <div className="flex justify-end">
        <button type="submit" className="fca-button-primary">
          {mode === "create" ? "Sponsor erstellen" : "Änderungen speichern"}
        </button>
      </div>
    </form>
  );
}
