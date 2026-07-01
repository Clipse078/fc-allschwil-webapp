import type {
  ReactNode,
  TdHTMLAttributes,
  ThHTMLAttributes,
  HTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

type Align = "left" | "center" | "right";

const ALIGN_CLASS: Record<Align, string> = {
  left: "text-left",
  center: "text-center",
  right: "text-right",
};

/**
 * DataTable — Premium table composition for SportClubEvo admin pages.
 *
 * A set of lightweight semantic wrappers that apply the single consistent
 * premium table experience: standardised header, row height, hover,
 * padding, and spacing tokens.
 *
 * Does NOT include toolbar, loading, empty, or pagination — those live in
 * the parent (e.g. ListPagePattern or a SectionCard shell). The DataTable
 * only wraps the `<table>` itself.
 *
 * Usage:
 *   <div className="overflow-x-auto">
 *     <DataTable>
 *       <DataTableHeader>
 *         <DataTableRow>
 *           <DataTableHead>Titel</DataTableHead>
 *           <DataTableHead>Status</DataTableHead>
 *           <DataTableHead align="right">Aktionen</DataTableHead>
 *         </DataTableRow>
 *       </DataTableHeader>
 *       <DataTableBody>
 *         {rows.map((row) => (
 *           <DataTableRow key={row.id} interactive>
 *             <DataTableCell>{row.title}</DataTableCell>
 *             <DataTableCell><StatusBadge /></DataTableCell>
 *             <DataTableCell align="right" muted>{row.date}</DataTableCell>
 *           </DataTableRow>
 *         ))}
 *       </DataTableBody>
 *     </DataTable>
 *   </div>
 *
 * All exported members:
 *   DataTable · DataTableHeader · DataTableBody
 *   DataTableRow · DataTableHead · DataTableCell
 */

export function DataTable({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <table className="w-full text-sm">{children}</table>
    </div>
  );
}

export function DataTableHeader({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <thead
      className={cn(
        "border-b border-[var(--border)] bg-[var(--surface-2)]",
        className,
      )}
    >
      {children}
    </thead>
  );
}

export function DataTableBody({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <tbody className={cn("divide-y divide-[var(--border)]", className)}>
      {children}
    </tbody>
  );
}

type DataTableRowProps = {
  children: ReactNode;
  className?: string;
  /** Adds a hover background for interactive / clickable rows. */
  interactive?: boolean;
} & Omit<HTMLAttributes<HTMLTableRowElement>, "className">;

export function DataTableRow({
  children,
  className,
  interactive = false,
  ...props
}: DataTableRowProps) {
  return (
    <tr
      className={cn(
        "bg-[var(--surface)]",
        interactive && "cursor-pointer transition-colors hover:bg-[var(--surface-2)]",
        className,
      )}
      {...props}
    >
      {children}
    </tr>
  );
}

type DataTableHeadProps = {
  children?: ReactNode;
  className?: string;
  align?: Align;
} & Omit<ThHTMLAttributes<HTMLTableCellElement>, "className">;

export function DataTableHead({
  children,
  className,
  align = "left",
  ...props
}: DataTableHeadProps) {
  return (
    <th
      className={cn(
        "px-4 py-3 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] whitespace-nowrap",
        ALIGN_CLASS[align],
        className,
      )}
      {...props}
    >
      {children}
    </th>
  );
}

type DataTableCellProps = {
  children?: ReactNode;
  className?: string;
  align?: Align;
  /** Applies muted small-text style for secondary metadata columns. */
  muted?: boolean;
} & Omit<TdHTMLAttributes<HTMLTableCellElement>, "className">;

export function DataTableCell({
  children,
  className,
  align = "left",
  muted = false,
  ...props
}: DataTableCellProps) {
  return (
    <td
      className={cn(
        "px-4 py-3",
        muted && "text-[11px] text-[var(--muted)]",
        ALIGN_CLASS[align],
        className,
      )}
      {...props}
    >
      {children}
    </td>
  );
}
