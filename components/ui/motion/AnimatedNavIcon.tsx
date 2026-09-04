"use client";

import { getNavIconKey } from "@/lib/motion/nav-icon-registry";
import { cn } from "@/lib/cn";
import { getNavIconComponent } from "./nav-icons";

export type AnimatedNavIconProps = {
  /** Sidebar nav label — resolved via registry. */
  label: string;
  active?: boolean;
  /** Parent nav items use larger icons; children are slightly quieter. */
  variant?: "parent" | "child";
  className?: string;
};

/**
 * SCE-DESIGN-04C/04D — Premium sidebar navigation iconography.
 *
 * Bespoke inline SVG with internal element motion driven by CSS.
 * Hover is triggered by parent `.sce-nav-item` / `.sce-nav-child`.
 * Respects prefers-reduced-motion; no whole-icon transforms.
 */
export function AnimatedNavIcon({
  label,
  active = false,
  variant = "parent",
  className,
}: AnimatedNavIconProps) {
  const iconKey = getNavIconKey(label);
  const IconComponent = getNavIconComponent(iconKey);

  return (
    <IconComponent
      active={active}
      size={variant === "child" ? "child" : "parent"}
      className={cn(
        variant === "child" && "sce-animated-nav-icon--child",
        className,
      )}
    />
  );
}
