"use client";

/**
 * Popover — REG-WAIT-01F
 *
 * Portal-based floating surface for combobox / filter dropdowns inside
 * overflow-hidden drawers. Uses @floating-ui for collision-aware placement.
 */

import { type ReactNode, useCallback, useEffect } from "react";
import {
  FloatingPortal,
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useDismiss,
  useFloating,
  useInteractions,
  useRole,
} from "@floating-ui/react";
import { cn } from "@/lib/cn";

type PopoverContentProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  children: ReactNode;
  id?: string;
  role?: "listbox" | "dialog";
  matchAnchorWidth?: boolean;
  maxHeight?: number;
  className?: string;
};

export function PopoverContent({
  open,
  onOpenChange,
  anchorRef,
  children,
  id,
  role = "listbox",
  matchAnchorWidth = true,
  maxHeight = 224,
  className,
}: PopoverContentProps) {
  const { refs, floatingStyles, context } = useFloating({
    open,
    onOpenChange,
    placement: "bottom-start",
    whileElementsMounted: open ? autoUpdate : undefined,
    middleware: [
      offset(6),
      flip({
        padding: 8,
        fallbackPlacements: ["top-start", "bottom-start", "top-end", "bottom-end"],
      }),
      shift({ padding: 8 }),
      size({
        padding: 8,
        apply({ availableHeight, elements, rects }) {
          Object.assign(elements.floating.style, {
            width: matchAnchorWidth ? `${rects.reference.width}px` : undefined,
            maxHeight: `${Math.min(maxHeight, Math.max(availableHeight - 8, 96))}px`,
          });
        },
      }),
    ],
  });

  useEffect(() => {
    refs.setReference(anchorRef.current);
  }, [anchorRef, refs, open]);

  const setFloatingRef = useCallback(
    (node: HTMLDivElement | null) => {
      refs.setFloating(node);
    },
    [refs],
  );

  const dismiss = useDismiss(context, { outsidePressEvent: "pointerdown" });
  const roleInteraction = useRole(context, { role });
  const { getFloatingProps } = useInteractions([dismiss, roleInteraction]);

  if (!open) return null;

  return (
    <FloatingPortal>
      <div
        ref={setFloatingRef}
        style={floatingStyles}
        id={id}
        className={cn(
          "z-[70] overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]",
          className,
        )}
        {...getFloatingProps()}
      >
        {children}
      </div>
    </FloatingPortal>
  );
}
