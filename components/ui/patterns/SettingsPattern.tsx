import type { ReactNode } from "react";
import { PageBreadcrumbs, PageHeader } from "@/components/ui/page";
import type { BreadcrumbItem } from "@/components/ui/page";
import { ActionBar, Card } from "@/components/ui";
import { cn } from "@/lib/cn";

export type SettingsPatternProps = {
  // ── Header ────────────────────────────────────────────────────────────────
  /** Short uppercase eyebrow label above the title. */
  eyebrow?: string;
  /** Primary settings page title (e.g. "Einstellungen", "Konto"). */
  title: string;
  /** Optional supporting description. */
  description?: string;
  /** Breadcrumb trail shown above the header. */
  breadcrumbs?: BreadcrumbItem[];
  // ── Settings content ───────────────────────────────────────────────────────
  /**
   * Grouped settings sections — typically <FormSection> children.
   * Each FormSection renders a label/description column + controls column
   * with its own border-b separator.
   */
  children: ReactNode;
  // ── Actions ────────────────────────────────────────────────────────────────
  /**
   * Primary save / apply action (right side of action bar).
   * Example: <Button type="submit">Speichern</Button>
   */
  primaryAction?: ReactNode;
  /**
   * Cancel / discard action (left side of action bar when primaryAction
   * is also present, otherwise right-aligned).
   */
  cancelAction?: ReactNode;
  /**
   * Stick the action bar to the bottom of the viewport. @default true
   */
  stickyActions?: boolean;
  // ── Danger zone ────────────────────────────────────────────────────────────
  /**
   * Destructive operations rendered in a visually distinct warning card below
   * the main settings and action bar (e.g. delete account, archive unit).
   * Keep to high-consequence, irreversible actions only.
   */
  dangerZone?: ReactNode;
  // ── Shell ──────────────────────────────────────────────────────────────────
  className?: string;
};

/**
 * SettingsPattern
 *
 * Reusable structural shell for settings / configuration pages.
 * Composes: PageBreadcrumbs · PageHeader · ActionBar · Card (danger zone)
 *           · FormSection (children)
 *
 * Does NOT include PageShell — callers wrap with <PageShell fullWidth> when
 * using inside the admin layout.
 *
 * Structure:
 *   breadcrumbs → header → settings sections (children)
 *   → sticky action bar (cancel | save) → danger zone card
 *
 * Usage:
 *   <PageShell fullWidth>
 *     <SettingsPattern
 *       eyebrow="Verein"
 *       title="Vereinseinstellungen"
 *       breadcrumbs={[
 *         { label: "Dashboard", href: "/dashboard" },
 *         { label: "Einstellungen" },
 *       ]}
 *       primaryAction={<Button type="submit" loading={isPending}>Speichern</Button>}
 *       cancelAction={<Button variant="secondary" onClick={reset}>Zurücksetzen</Button>}
 *       dangerZone={
 *         <div>
 *           <p className="text-sm text-[var(--sce-warning)]">Verein löschen</p>
 *           <Button variant="danger" className="mt-3">Verein unwiderruflich löschen</Button>
 *         </div>
 *       }
 *     >
 *       <FormSection title="Allgemein" description="Grundlegende Vereinsinfos.">
 *         <InputField label="Name" … />
 *       </FormSection>
 *       <FormSection title="Kontakt">
 *         <InputField label="E-Mail" … />
 *       </FormSection>
 *     </SettingsPattern>
 *   </PageShell>
 */
export function SettingsPattern({
  eyebrow,
  title,
  description,
  breadcrumbs,
  children,
  primaryAction,
  cancelAction,
  stickyActions = true,
  dangerZone,
  className,
}: SettingsPatternProps) {
  const hasActions = !!(primaryAction ?? cancelAction);
  const hasBothActions = !!(primaryAction && cancelAction);

  return (
    <div className={cn("flex flex-col", className)}>
      {breadcrumbs && breadcrumbs.length > 0 && (
        <PageBreadcrumbs items={breadcrumbs} />
      )}

      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
      />

      <div className="flex flex-col">{children}</div>

      {hasActions && (
        <ActionBar
          sticky={stickyActions}
          align={hasBothActions ? "between" : "right"}
          className="mt-6"
        >
          {cancelAction}
          {primaryAction}
        </ActionBar>
      )}

      {dangerZone && (
        <Card variant="warning" title="Gefahrenzone" className="mt-8">
          {dangerZone}
        </Card>
      )}
    </div>
  );
}
