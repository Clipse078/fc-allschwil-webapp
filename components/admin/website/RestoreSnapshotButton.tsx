"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, History, X } from "lucide-react";
import { restoreFromSnapshot } from "@/app/(admin)/dashboard/website/pages/[pageId]/actions";

type Props = { snapshotId: string };

export default function RestoreSnapshotButton({ snapshotId }: Props) {
  const [confirming, setConfirming] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRestore() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("snapshotId", snapshotId);
      const result = await restoreFromSnapshot(fd);
      if (result.ok) {
        setDone(true);
        setConfirming(false);
      } else {
        setError(result.error);
        setConfirming(false);
      }
    });
  }

  if (done) {
    return (
      <div className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-600">
        <CheckCircle2 className="h-3 w-3" />
        Entwurf wiederhergestellt
      </div>
    );
  }

  if (error) {
    return <p className="text-[11px] text-rose-600">{error}</p>;
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-2 rounded-[12px] border border-[#0b4aa2]/20 bg-[#0b4aa2]/5 p-3">
        <p className="text-[11px] leading-relaxed text-slate-600">
          Erstellt einen neuen Entwurf aus diesem Snapshot. Die Live-Website
          bleibt unverändert bis du erneut publizierst.
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRestore}
            disabled={isPending}
            className="rounded-full bg-[#0b4aa2] px-3 py-1 text-[11px] font-semibold text-white disabled:opacity-50"
          >
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
      className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 transition hover:border-[#0b4aa2]/30 hover:text-[#0b4aa2]"
    >
      <History className="h-3 w-3" />
      Wiederherstellen
    </button>
  );
}
