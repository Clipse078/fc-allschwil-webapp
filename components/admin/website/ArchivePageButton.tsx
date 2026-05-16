"use client";

import { useState, useTransition } from "react";
import { Archive, AlertTriangle, Info, X } from "lucide-react";
import { archivePage } from "@/app/(admin)/dashboard/website/pages/[pageId]/actions";

type Props = {
  pageId: string;
  isPublished: boolean;
};

export default function ArchivePageButton({ pageId, isPublished }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleArchive() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("pageId", pageId);
      const result = await archivePage(fd);
      if (result.ok) setDone(true);
      else { setError(result.error); setConfirming(false); }
    });
  }

  if (done) {
    return (
      <span className="text-[11px] font-semibold text-slate-400">Archiviert</span>
    );
  }

  if (confirming) {
    return (
      <div className="space-y-2 rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm">
        {isPublished && (
          <div className="flex items-start gap-2 rounded-[10px] border border-amber-100 bg-amber-50/70 px-3 py-2">
            <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
            <p className="text-[11px] text-amber-800">
              Der publizierte Snapshot bleibt live bis du ihn durch Publikation
              einer neuen Seite ersetzt.
            </p>
          </div>
        )}
        <div className="flex items-start gap-2 rounded-[10px] border border-[#0b4aa2]/10 bg-[#0b4aa2]/5 px-3 py-2">
          <Info className="mt-0.5 h-3 w-3 shrink-0 text-[#0b4aa2]" />
          <p className="text-[11px] text-slate-600">
            Archivierung behält die Historie. Publizierte Snapshots werden nicht
            automatisch entfernt.
          </p>
        </div>
        {error && <p className="text-[11px] text-rose-600">{error}</p>}
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleArchive}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-full border border-slate-300 bg-slate-100 px-3 py-1.5 text-[12px] font-semibold text-slate-700 transition hover:bg-slate-200 disabled:opacity-50"
          >
            <Archive className="h-3 w-3" />
            {isPending ? "Archivieren …" : "Bestätigen"}
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-600"
          >
            <X className="h-3 w-3" />
            Abbrechen
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-400 transition hover:border-slate-300 hover:text-slate-600"
    >
      <Archive className="h-3 w-3" />
      Archivieren
    </button>
  );
}
