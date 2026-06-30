"use client";

import { useContext } from "react";
import { ToastContext, type ToastContextValue } from "@/components/ui/ToastProvider";

/**
 * useToast
 *
 * Returns the shared toast API from the nearest <ToastProvider>.
 * Must be rendered inside <ToastProvider>.
 *
 * Usage:
 *   const { toast } = useToast();
 *   toast.success("Gespeichert");
 *   toast.danger("Fehler beim Speichern", { duration: 6000 });
 */
export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}
