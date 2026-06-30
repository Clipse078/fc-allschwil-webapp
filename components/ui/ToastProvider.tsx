"use client";

import {
  createContext,
  useCallback,
  useState,
  type ReactNode,
} from "react";
import { Toast, type ToastItem, type ToastVariant } from "./Toast";
import { cn } from "@/lib/cn";

type AddToastOptions = {
  /** Auto-dismiss duration in ms. 0 = no auto-dismiss. @default 4000 */
  duration?: number;
};

type ToastAPI = {
  [K in ToastVariant]: (message: ReactNode, options?: AddToastOptions) => void;
};

export type ToastContextValue = {
  toast: ToastAPI;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

let _counter = 0;
function nextId() {
  return `toast-${++_counter}`;
}

/**
 * ToastProvider
 *
 * Mount once at the root of the admin shell (or the closest layout boundary).
 * Provides the `toast` API to all descendant components via `useToast()`.
 *
 * Usage (in layout.tsx):
 *   <ToastProvider>
 *     {children}
 *   </ToastProvider>
 *
 * Usage (in a component):
 *   const { toast } = useToast();
 *   toast.success("Gespeichert");
 *   toast.danger("Fehler", { duration: 0 }); // no auto-dismiss
 */
export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const add = useCallback(
    (variant: ToastVariant, message: ReactNode, options?: AddToastOptions) => {
      const item: ToastItem = {
        id: nextId(),
        variant,
        message,
        duration: options?.duration ?? 4000,
      };
      setToasts((prev) => [...prev, item]);
    },
    [],
  );

  const toast: ToastAPI = {
    success: (msg, opts) => add("success", msg, opts),
    warning: (msg, opts) => add("warning", msg, opts),
    danger:  (msg, opts) => add("danger",  msg, opts),
    info:    (msg, opts) => add("info",    msg, opts),
    neutral: (msg, opts) => add("neutral", msg, opts),
  };

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}

      {/* Toast stack — bottom-right, above everything */}
      <div
        aria-label="Benachrichtigungen"
        className={cn(
          "pointer-events-none fixed bottom-5 right-5 z-[9999]",
          "flex flex-col items-end gap-2",
        )}
      >
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto w-full max-w-sm">
            <Toast {...t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
