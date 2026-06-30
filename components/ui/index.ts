/**
 * components/ui — SportClubEvo Design System Primitives
 *
 * Reusable, token-driven UI primitives for the internal SportClubEvo WebApp.
 * All components use --sce-* CSS custom properties and are NOT affected by
 * tenant branding overrides.
 *
 * Canonical usage:
 *   import { Button, Badge, Card, Dialog } from "@/components/ui";
 */

// ── Slice 1 ────────────────────────────────────────────────────────────────
export { Button } from "./Button";
export type { ButtonProps, ButtonVariant, ButtonSize } from "./Button";

export { Badge } from "./Badge";
export type { BadgeProps, BadgeVariant, BadgeSize } from "./Badge";

// ── Slice 2 ────────────────────────────────────────────────────────────────
export { Card } from "./Card";
export type { CardProps, CardVariant } from "./Card";

export { FormSection } from "./FormSection";
export type { FormSectionProps } from "./FormSection";

export { ActionBar } from "./ActionBar";
export type { ActionBarProps, ActionBarAlign } from "./ActionBar";

export { StatusIndicator } from "./StatusIndicator";
export type {
  StatusIndicatorProps,
  StatusIndicatorVariant,
  StatusIndicatorSize,
} from "./StatusIndicator";

export { LoadingSkeleton } from "./LoadingSkeleton";
export type { LoadingSkeletonProps, LoadingSkeletonVariant } from "./LoadingSkeleton";

export { Dialog } from "./Dialog";
export type { DialogProps, DialogSize } from "./Dialog";

export { Toast } from "./Toast";
export type { ToastItem, ToastVariant } from "./Toast";

export { ToastProvider, ToastContext } from "./ToastProvider";
export type { ToastContextValue } from "./ToastProvider";
