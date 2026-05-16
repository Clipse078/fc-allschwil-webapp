"use client";

import { useState, useTransition } from "react";
import { ArchiveRestore, Info, X } from "lucide-react";
import { unarchivePage } from "@/app/(admin)/dashboard/website/pages/[pageId]/actions";

export default function UnarchiveButton({ pageId }: { pageId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleUnarchive() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("pageId", pageId);
      const result = await unarchivePage(fd);
      if (result.ok) setDone(true);
      else { setError(result.error); setConfirming(false); }
    });
  }

  if (done) {
    return (
      <span className="text-[11px] font-semibold text-emerald-600">
        Wiederhergestellt
      </span>
    );
  }

  if (confirming) {
    return (
      <div className="space-y-2 rounded-[14px] border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex items-start gap-2 rounded-[10px] border border-[#0b4aa2]/10 bg-[#0b4aa2]/5 px-3 py-2">
          <Info className="mt-0.5 h-3 w-3 shrink-0 text-[#0b4aa2]" />
          <p className="text-[11px] text-slate-600">
            Setzt die Seite zurück in Entwürfe. Es wird nichts publiziert.
          </p>
        </div>
        {error && <p className="text-[11px] text-rose-600">{error}</p>}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleUnarchive}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-full bg-[#0b4aa2] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
          >
            <ArchiveRestore className="h-3 w-3" />
            {isPending ? "Wiederherstellen …" : "Bestätigen"}
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
      className="flex items-center gap-1.5 rounded-full border border-[#0b4aa2]/20 bg-[#0b4aa2]/5 px-2.5 py-1 text-[11px] font-semibold text-[#0b4aa2] transition hover:bg-[#0b4aa2]/10"
    >
      <ArchiveRestore className="h-3 w-3" />
      Wiederherstellen
    </button>
  );
}
