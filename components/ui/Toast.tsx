"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { X, CheckCircle2, AlertTriangle, XCircle, Info, Circle } from "lucide-react";
import { cn } from "@/lib/cn";

export type ToastVariant = "success" | "warning" | "danger" | "info" | "neutral";

export type ToastItem = {
  id: string;
  variant: ToastVariant;
  message: ReactNode;
  /** Auto-dismiss duration in ms. 0 = no auto-dismiss. @default 4000 */
  duration?: number;
};

type ToastProps = ToastItem & {
  onDismiss: (id: string) => void;
};

const variantConfig: Record<
  ToastVariant,
  { icon: ReactNode; className: string }
> = {
  success: {
    icon: <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />,
    className: [
      "border-[var(--sce-success-border)] bg-[var(--sce-success-light)]",
      "text-[var(--sce-success)]",
    ].join(" "),
  },
  warning: {
    icon: <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />,
    className: [
      "border-[var(--sce-warning-border)] bg-[var(--sce-warning-light)]",
      "text-[var(--sce-warning)]",
    ].join(" "),
  },
  danger: {
    icon: <XCircle className="h-4 w-4 shrink-0" aria-hidden="true" />,
    className: [
      "border-[var(--sce-danger-border)] bg-[var(--sce-danger-light)]",
      "text-[var(--sce-danger)]",
    ].join(" "),
  },
  info: {
    icon: <Info className="h-4 w-4 shrink-0" aria-hidden="true" />,
    className: [
      "border-[var(--sce-info-border)] bg-[var(--sce-info-light)]",
      "text-[var(--sce-info)]",
    ].join(" "),
  },
  neutral: {
    icon: <Circle className="h-4 w-4 shrink-0" aria-hidden="true" />,
    className: [
      "border-[var(--border)] bg-[var(--surface)]",
      "text-[var(--text-2)]",
    ].join(" "),
  },
};

/**
 * Toast
 *
 * Individual toast notification item.
 * Rendered by <ToastProvider> — do not use standalone.
 */
export function Toast({ id, variant, message, duration = 4000, onDismiss }: ToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (duration === 0) return;
    timerRef.current = setTimeout(() => onDismiss(id), duration);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [id, duration, onDismiss]);

  const { icon, className } = variantConfig[variant];

  return (
    <div
      role="alert"
      aria-live="assertive"
      aria-atomic="true"
      className={cn(
        "flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3",
        "shadow-[var(--shadow-md)]",
        "animate-in slide-in-from-right-2 fade-in duration-200",
        className,
      )}
    >
      <span className="mt-0.5">{icon}</span>

      <p className="flex-1 text-sm font-medium leading-snug">{message}</p>

      <button
        type="button"
        aria-label="Meldung schließen"
        onClick={() => onDismiss(id)}
        className={cn(
          "shrink-0 rounded-md p-0.5 opacity-60",
          "hover:opacity-100 transition-opacity duration-[120ms]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current",
        )}
      >
        <X className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}
