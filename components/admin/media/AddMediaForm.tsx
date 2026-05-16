"use client";

import { useState } from "react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { createMediaAssetAction } from "@/app/(admin)/dashboard/website/media/actions";

const inputCls =
  "w-full rounded-[16px] border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100";

export default function AddMediaForm() {
  const [url, setUrl] = useState("");
  const [open, setOpen] = useState(false);

  return (
    <AdminSurfaceCard className="p-5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-900">Asset hinzufügen</p>
          <p className="mt-0.5 text-xs text-slate-500">
            URL-basiert — Drag &amp; Drop Upload folgt in Kürze.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="fca-button-primary shrink-0"
        >
          {open ? "Abbrechen" : "+ Asset"}
        </button>
      </div>

      {open && (
        <form action={createMediaAssetAction} className="mt-5 space-y-4 border-t border-slate-100 pt-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="fca-label">URL *</span>
              <input
                type="url"
                name="url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                required
                placeholder="https://…"
                className={inputCls}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="fca-label">Typ</span>
              <select name="type" className="fca-select">
                <option value="IMAGE">Bild (IMAGE)</option>
                <option value="VIDEO">Video (VIDEO)</option>
                <option value="PDF">PDF (PDF)</option>
                <option value="OTHER">Sonstiges</option>
              </select>
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="fca-label">Titel</span>
              <input
                type="text"
                name="title"
                placeholder="Automatisch aus URL"
                className={inputCls}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="fca-label">Alt-Text</span>
              <input
                type="text"
                name="altText"
                placeholder="Für Barrierefreiheit"
                className={inputCls}
              />
            </label>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <label className="block space-y-1.5">
              <span className="fca-label">Ordner</span>
              <input
                type="text"
                name="folder"
                placeholder="z. B. hero, teams"
                className={inputCls}
              />
            </label>

            <label className="block space-y-1.5">
              <span className="fca-label">Tags (Komma)</span>
              <input
                type="text"
                name="tags"
                placeholder="sponsor, logo, 2025"
                className={inputCls}
              />
            </label>

            <div className="grid grid-cols-2 gap-2">
              <label className="block space-y-1.5">
                <span className="fca-label">Breite</span>
                <input
                  type="number"
                  name="width"
                  placeholder="px"
                  min={1}
                  className={inputCls}
                />
              </label>
              <label className="block space-y-1.5">
                <span className="fca-label">Höhe</span>
                <input
                  type="number"
                  name="height"
                  placeholder="px"
                  min={1}
                  className={inputCls}
                />
              </label>
            </div>
          </div>

          {url && (
            <div className="flex h-20 w-32 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50 p-1">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={url}
                alt="Vorschau"
                className="max-h-full max-w-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}

          <div className="flex justify-end">
            <button type="submit" className="fca-button-primary">
              Speichern
            </button>
          </div>
        </form>
      )}
    </AdminSurfaceCard>
  );
}
