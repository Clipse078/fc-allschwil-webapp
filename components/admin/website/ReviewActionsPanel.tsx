"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Send, ThumbsDown, ThumbsUp, X } from "lucide-react";
import {
  approveAndPublish,
  rejectReview,
  submitForReview,
} from "@/app/(admin)/dashboard/website/pages/[pageId]/actions";

// ── Submit for review ─────────────────────────────────────────────────────────

export function SubmitForReviewButton({ pageId }: { pageId: string }) {
  const [note, setNote] = useState("");
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit() {
    setError(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("pageId", pageId);
      if (note.trim()) fd.append("reviewNote", note.trim());
      const result = await submitForReview(fd);
      if (result.ok) setDone(true);
      else setError(result.error);
    });
  }

  if (done) {
    return (
      <div className="flex items-center gap-2 rounded-[12px] border border-amber-200 bg-amber-50 px-3 py-2">
        <Send className="h-3.5 w-3.5 text-amber-600" />
        <p className="text-[12px] text-amber-800 font-semibold">
          Zur Prüfung eingereicht.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <textarea
        rows={2}
        placeholder="Hinweis für den Prüfer (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="w-full resize-none rounded-[12px] border border-slate-200 px-3 py-2 text-sm text-slate-700 outline-none focus:border-amber-300"
      />
      {error && <p className="text-[11px] text-rose-600">{error}</p>}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending}
        className="flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
      >
        <Send className="h-3.5 w-3.5" />
        {isPending ? "Einreichen …" : "Zur Prüfung einreichen"}
      </button>
    </div>
  );
}

// ── Approve + Reject ─────────────────────────────────────────────────────────

type ReviewState =
  | { kind: "idle" }
  | { kind: "approved" }
  | { kind: "rejected" }
  | { kind: "error"; message: string };

export function ReviewApprovalPanel({ pageId }: { pageId: string }) {
  const [state, setState] = useState<ReviewState>({ kind: "idle" });
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleApprove() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("pageId", pageId);
      const result = await approveAndPublish(fd);
      if (result.ok) setState({ kind: "approved" });
      else setState({ kind: "error", message: result.error });
    });
  }

  function handleReject() {
    startTransition(async () => {
      const fd = new FormData();
      fd.append("pageId", pageId);
      if (rejectNote.trim()) fd.append("rejectNote", rejectNote.trim());
      const result = await rejectReview(fd);
      if (result.ok) setState({ kind: "rejected" });
      else setState({ kind: "error", message: result.error });
    });
  }

  if (state.kind === "approved") {
    return (
      <div className="flex items-center gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2">
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
        <p className="text-[12px] font-semibold text-emerald-800">
          Freigegeben und publiziert.
        </p>
      </div>
    );
  }

  if (state.kind === "rejected") {
    return (
      <div className="flex items-center gap-2 rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2">
        <X className="h-3.5 w-3.5 text-slate-500" />
        <p className="text-[12px] text-slate-600">
          Abgelehnt. Seite zurück in Entwurf.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {state.kind === "error" && (
        <p className="text-[11px] text-rose-600">{state.message}</p>
      )}

      {/* Approve */}
      <button
        type="button"
        onClick={handleApprove}
        disabled={isPending || showRejectForm}
        className="flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:opacity-50"
      >
        <ThumbsUp className="h-3.5 w-3.5" />
        {isPending && !showRejectForm ? "Freigeben …" : "Freigeben & Publizieren"}
      </button>

      {/* Reject flow */}
      {!showRejectForm ? (
        <button
          type="button"
          onClick={() => setShowRejectForm(true)}
          disabled={isPending}
          className="flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-50"
        >
          <ThumbsDown className="h-3.5 w-3.5" />
          Ablehnen
        </button>
      ) : (
        <div className="space-y-2 rounded-[14px] border border-rose-100 bg-rose-50/60 p-3">
          <p className="text-[11px] font-semibold text-rose-700">
            Ablehnungsgrund (optional)
          </p>
          <textarea
            rows={2}
            placeholder="Feedback für den Autor"
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            className="w-full resize-none rounded-[10px] border border-rose-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-rose-400"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleReject}
              disabled={isPending}
              className="rounded-full bg-rose-600 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
            >
              {isPending ? "Ablehnen …" : "Bestätigen"}
            </button>
            <button
              type="button"
              onClick={() => setShowRejectForm(false)}
              className="flex items-center gap-1 text-[12px] text-slate-400 hover:text-slate-600"
            >
              <X className="h-3 w-3" />
              Abbrechen
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
