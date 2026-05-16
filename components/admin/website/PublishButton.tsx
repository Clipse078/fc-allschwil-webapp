"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Globe, AlertTriangle } from "lucide-react";
import { publishPage } from "@/app/(admin)/dashboard/website/pages/[pageId]/actions";

type Props = {
  pageId: string;
  isAlreadyPublished: boolean;
};

type State =
  | { kind: "idle" }
  | { kind: "success" }
  | { kind: "review" }
  | { kind: "error"; message: string };

export default function PublishButton({ pageId, isAlreadyPublished }: Props) {
  const [state, setState] = useState<State>({ kind: "idle" });
  const [isPending, startTransition] = useTransition();

  function handlePublish() {
    setState({ kind: "idle" });
    startTransition(async () => {
      const fd = new FormData();
      fd.append("pageId", pageId);
      const result = await publishPage(fd);

      if (result.ok) {
        setState({ kind: "success" });
      } else if (result.requiresReview) {
        setState({ kind: "review" });
      } else {
        setState({ kind: "error", message: result.error });
      }
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handlePublish}
        disabled={isPending}
        className="flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        <Globe className="h-3.5 w-3.5" />
        {isPending
          ? "Publizieren …"
          : isAlreadyPublished
            ? "Snapshot aktualisieren"
            : "Publizieren"}
      </button>

      {state.kind === "success" && (
        <div className="flex items-center gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <p className="text-[12px] text-emerald-800">
            Öffentlicher Website-Snapshot wurde aktualisiert.
          </p>
        </div>
      )}

      {state.kind === "review" && (
        <div className="flex items-start gap-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
          <p className="text-[12px] text-amber-800">
            Seite wurde zur Prüfung eingereicht. Nach Freigabe wird der Snapshot
            publiziert.
          </p>
        </div>
      )}

      {state.kind === "error" && (
        <div className="rounded-[12px] border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-800">
          {state.message}
        </div>
      )}
    </div>
  );
}
