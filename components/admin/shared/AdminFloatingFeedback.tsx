"use client";

import { AlertCircle, CheckCircle2, LoaderCircle, X } from "lucide-react";

export type AdminFeedbackTone = "success" | "error" | "loading";

type AdminFloatingFeedbackProps = {
  message: string | null;
  tone: AdminFeedbackTone;
  onDismiss?: () => void;
};

const toneStyles: Record<AdminFeedbackTone, string> = {
  success: "border-emerald-200 bg-white text-emerald-800",
  error: "border-rose-200 bg-white text-rose-800",
  loading: "border-slate-200 bg-white text-slate-700",
};

export default function AdminFloatingFeedback({
  message,
  tone,
  onDismiss,
}: AdminFloatingFeedbackProps) {
  if (!message) return null;

  const Icon =
    tone === "success"
      ? CheckCircle2
      : tone === "error"
        ? AlertCircle
        : LoaderCircle;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-6 z-50 flex justify-center px-4"
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
    >
      <div
        className={`pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl border px-4 py-3 text-sm font-medium shadow-[0_16px_48px_rgba(15,23,42,0.16)] backdrop-blur ${toneStyles[tone]}`}
      >
        <Icon
          className={`h-4 w-4 shrink-0 ${
            tone === "loading" ? "animate-spin" : ""
          }`}
          aria-hidden="true"
        />

        <span>{message}</span>

        {onDismiss && tone !== "loading" ? (
          <button
            type="button"
            onClick={onDismiss}
            className="ml-1 rounded-full p-1 opacity-60 transition hover:bg-slate-100 hover:opacity-100"
            aria-label="Meldung schliessen"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
