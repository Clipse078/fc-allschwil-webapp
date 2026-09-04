"use client";

import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/cn";
import type { MotionIntent } from "@/lib/motion/types";

export type MotionIconProps = {
  icon: LucideIcon;
  /** Standardized motion intent — drives CSS transform on hover/active. */
  intent?: MotionIntent;
  className?: string;
  /** When true, icon is inside an active nav item (subtle settle). */
  active?: boolean;
};

/**
 * MotionIcon — SCE premium motion primitive for Lucide icons.
 *
 * Animations are CSS-driven, triggered on parent hover/active.
 * Respects prefers-reduced-motion via global CSS.
 * No continuous animation — motion stops when interaction ends.
 */
export function MotionIcon({
  icon: Icon,
  intent = "hover",
  className,
  active = false,
}: MotionIconProps) {
  return (
    <Icon
      aria-hidden="true"
      data-motion-intent={intent}
      className={cn(
        "sce-motion-icon shrink-0",
        active && "sce-motion-icon--active",
        className,
      )}
    />
  );
}
