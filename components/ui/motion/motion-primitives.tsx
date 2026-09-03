"use client";

import type { ReactNode, SVGProps } from "react";
import { cn } from "@/lib/cn";
import type { NavIconKey } from "@/lib/motion/nav-icon-keys";

export type NavIconSvgProps = {
  iconKey: NavIconKey;
  active?: boolean;
  size?: "parent" | "child";
  className?: string;
  children: ReactNode;
};

const SIZE_MAP = {
  parent: "h-4 w-4",
  child: "h-3.5 w-3.5",
} as const;

/**
 * Shared SVG frame for premium sidebar nav icons.
 * Internal elements animate via CSS; no whole-icon transforms.
 */
export function NavIconSvg({
  iconKey,
  active = false,
  size = "parent",
  className,
  children,
}: NavIconSvgProps) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      data-nav-icon={iconKey}
      className={cn(
        "sce-animated-nav-icon shrink-0",
        active && "sce-animated-nav-icon--active",
        SIZE_MAP[size],
        className,
      )}
    >
      {children}
    </svg>
  );
}

type CopperFlowProps = {
  className?: string;
  d: string;
};

/** Traveling copper stroke — used semantically for connection/publish/sync. */
export function CopperFlow({ className, d }: CopperFlowProps) {
  return (
    <path
      d={d}
      className={cn("sce-nav-copper-flow", className)}
      stroke="var(--sce-nav-icon-copper)"
      strokeWidth="1.5"
      fill="none"
      pathLength={1}
    />
  );
}

type StrokePathProps = SVGProps<SVGPathElement> & {
  className?: string;
};

export function StrokePath({ className, ...props }: StrokePathProps) {
  return <path className={cn("sce-nav-stroke", className)} {...props} />;
}

export function StrokeLine({
  className,
  ...props
}: SVGProps<SVGLineElement> & { className?: string }) {
  return <line className={cn("sce-nav-stroke", className)} {...props} />;
}

export function StrokeRect({
  className,
  ...props
}: SVGProps<SVGRectElement> & { className?: string }) {
  return <rect className={cn("sce-nav-stroke", className)} {...props} />;
}

export function StrokeCircle({
  className,
  ...props
}: SVGProps<SVGCircleElement> & { className?: string }) {
  return <circle className={cn("sce-nav-stroke", className)} {...props} />;
}

export function FillRect({
  className,
  ...props
}: SVGProps<SVGRectElement> & { className?: string }) {
  return <rect className={cn("sce-nav-fill", className)} {...props} />;
}
