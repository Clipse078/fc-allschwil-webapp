"use client";

import { useState } from "react";
import { Copy, Check, Trash2, FileText, Film, File } from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { deleteMediaAssetAction } from "@/app/(admin)/dashboard/website/media/actions";
import type { MediaAssetListItem } from "@/lib/website/media-queries";

function CopyButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text
    }
  }

  return (
    <button
      type="button"
      onClick={handleCopy}
      title="URL kopieren"
      className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:bg-slate-50 hover:text-slate-900"
    >
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-600" />
      ) : (
        <Copy className="h-3.5 w-3.5" />
      )}
    </button>
  );
}

function TypeIcon({ type }: { type: string }) {
  switch (type) {
    case "VIDEO":
      return <Film className="h-8 w-8 text-slate-400" />;
    case "PDF":
      return <FileText className="h-8 w-8 text-slate-400" />;
    default:
      return <File className="h-8 w-8 text-slate-400" />;
  }
}

type MediaGridProps = {
  assets: MediaAssetListItem[];
  typeFilter: string;
};

export default function MediaGrid({ assets, typeFilter }: MediaGridProps) {
  const filtered =
    typeFilter === "ALL" ? assets : assets.filter((a) => a.type === typeFilter);

  if (filtered.length === 0) {
    return (
      <AdminSurfaceCard className="p-6">
        <p className="text-sm text-slate-500">
          {assets.length === 0
            ? "Noch keine Medien-Assets vorhanden. Füge dein erstes Asset hinzu."
            : "Keine Assets für diesen Filter."}
        </p>
      </AdminSurfaceCard>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {filtered.map((asset) => (
        <div
          key={asset.id}
          className="group flex flex-col overflow-hidden rounded-[20px] border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
        >
          <div className="relative flex h-36 items-center justify-center overflow-hidden bg-slate-50">
            {asset.type === "IMAGE" ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={asset.url}
                alt={asset.altText ?? asset.title}
                className="h-full w-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <TypeIcon type={asset.type} />
            )}
            <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/0 opacity-0 transition group-hover:bg-black/10 group-hover:opacity-100">
              <CopyButton url={asset.url} />
              <form action={deleteMediaAssetAction}>
                <input type="hidden" name="assetId" value={asset.id} />
                <button
                  type="submit"
                  title="Löschen"
                  className="flex h-7 w-7 items-center justify-center rounded-lg border border-red-200 bg-white text-red-500 transition hover:bg-red-50"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </form>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-1 p-3">
            <p className="truncate text-xs font-semibold text-slate-800">
              {asset.title}
            </p>
            {asset.folder && (
              <p className="truncate text-[11px] text-slate-400">{asset.folder}</p>
            )}
            {asset.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {asset.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
