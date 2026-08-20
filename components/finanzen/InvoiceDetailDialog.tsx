"use client";

import {
  AlertCircle,
  Ban,
  CheckCircle,
  ChevronRight,
  Edit2,
  FileDown,
  Mail,
  X,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  type Invoice,
  INVOICE_STATUS_CONFIG,
  calcInvoiceTotals,
  fmtCHF,
} from "./rechnungen-data";
import { cn } from "@/lib/cn";

type Props = {
  invoice: Invoice | null;
  onClose: () => void;
};

const MOCKED_ACTIONS = [
  {
    icon: Edit2,
    label: "Bearbeiten",
    description: "Entwurf bearbeiten",
    onlyStatuses: ["Entwurf"],
  },
  {
    icon: Mail,
    label: "Als versendet markieren",
    description: "Status auf «Offen» setzen",
    onlyStatuses: ["Entwurf", "Offen"],
  },
  {
    icon: CheckCircle,
    label: "Zahlung erfassen",
    description: "Eingang manuell buchen",
    onlyStatuses: ["Offen", "Überfällig"],
  },
  {
    icon: FileDown,
    label: "PDF anzeigen",
    description: "Druckvorschau öffnen",
    onlyStatuses: ["Entwurf", "Offen", "Überfällig", "Bezahlt"],
  },
  {
    icon: Ban,
    label: "Stornieren",
    description: "Rechnung stornieren",
    onlyStatuses: ["Entwurf", "Offen", "Überfällig"],
    danger: true,
  },
] as const;

export function InvoiceDetailDialog({ invoice, onClose }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!invoice) return;
    panelRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [invoice, onClose]);

  if (!invoice) return null;

  const { subtotal, totalVat, total } = calcInvoiceTotals(invoice.positions);
  const statusCfg = INVOICE_STATUS_CONFIG[invoice.status];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" aria-hidden="true" />

      {/* Panel */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="inv-dialog-title"
        tabIndex={-1}
        className={cn(
          "relative z-10 flex w-full max-w-3xl flex-col",
          "max-h-[90vh] overflow-hidden",
          "rounded-2xl border border-[var(--border)] bg-[var(--surface)]",
          "shadow-[var(--shadow-xl)] outline-none",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="inv-dialog-title" className="text-base font-semibold text-[var(--foreground)]">
                {invoice.number}
              </h2>
              <Badge variant={statusCfg.variant}>{invoice.status}</Badge>
              <Badge variant="warning" size="sm">In Entwicklung</Badge>
            </div>
            <p className="mt-0.5 text-sm text-[var(--text-2)]">{invoice.subject}</p>
          </div>
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto">
          <div className="grid gap-6 px-6 py-5 md:grid-cols-[1fr_240px]">
            {/* Left: main invoice content */}
            <div className="space-y-5">
              {/* Recipient block */}
              <div>
                <p className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Empfänger
                </p>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-[var(--foreground)]">{invoice.recipient}</p>
                      <p className="text-xs text-[var(--text-2)] mt-0.5">{invoice.recipientAddress}</p>
                      {invoice.recipientContact && (
                        <p className="text-xs text-[var(--muted)] mt-0.5">{invoice.recipientContact}</p>
                      )}
                    </div>
                    <Badge variant="default" size="sm">{invoice.recipientType}</Badge>
                  </div>
                </div>
              </div>

              {/* Dates row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1">
                    Rechnungsdatum
                  </p>
                  <p className="text-sm font-medium text-[var(--foreground)]">{invoice.issueDate}</p>
                </div>
                <div className={cn(
                  "rounded-lg border px-4 py-3",
                  invoice.status === "Überfällig"
                    ? "border-[var(--sce-danger-light)] bg-[var(--sce-danger-light)]"
                    : "border-[var(--border)] bg-[var(--surface-2)]",
                )}>
                  <p className="text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1">
                    Fälligkeitsdatum
                  </p>
                  <p className={cn(
                    "text-sm font-medium",
                    invoice.status === "Überfällig" ? "text-[var(--sce-danger)]" : "text-[var(--foreground)]",
                  )}>
                    {invoice.dueDate}
                    {invoice.status === "Überfällig" && (
                      <AlertCircle className="ml-1.5 inline h-3.5 w-3.5" />
                    )}
                  </p>
                </div>
              </div>

              {/* Positions table */}
              <div>
                <p className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Rechnungspositionen
                </p>
                <div className="rounded-lg border border-[var(--border)] overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                        <th className="px-3 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                          Bezeichnung
                        </th>
                        <th className="px-3 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                          Menge
                        </th>
                        <th className="px-3 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                          Preis
                        </th>
                        <th className="px-3 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                          MwSt.
                        </th>
                        <th className="px-3 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                          Total
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {invoice.positions.map((pos) => {
                        const base = pos.menge * pos.einzelpreis;
                        const vat = pos.mwstPct ? base * (pos.mwstPct / 100) : 0;
                        return (
                          <tr key={pos.id} className="hover:bg-[var(--surface-2)]">
                            <td className="px-3 py-2.5 text-[var(--foreground)] font-medium">
                              {pos.bezeichnung}
                            </td>
                            <td className="px-3 py-2.5 text-right text-[var(--text-2)]">
                              {pos.menge}×
                            </td>
                            <td className="px-3 py-2.5 text-right text-[var(--text-2)]">
                              {fmtCHF(pos.einzelpreis)}
                            </td>
                            <td className="px-3 py-2.5 text-right text-[var(--muted)]">
                              {pos.mwstPct ? `${pos.mwstPct}%` : "—"}
                            </td>
                            <td className="px-3 py-2.5 text-right font-semibold text-[var(--foreground)]">
                              {fmtCHF(base + vat)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {/* Totals */}
                  <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 space-y-1.5">
                    <div className="flex justify-between text-xs text-[var(--text-2)]">
                      <span>Zwischensumme</span>
                      <span>{fmtCHF(subtotal)}</span>
                    </div>
                    {totalVat > 0 && (
                      <div className="flex justify-between text-xs text-[var(--text-2)]">
                        <span>MwSt. (inkl.)</span>
                        <span>{fmtCHF(totalVat)}</span>
                      </div>
                    )}
                    <div className="flex justify-between border-t border-[var(--border)] pt-1.5 text-sm font-bold text-[var(--foreground)]">
                      <span>Total CHF</span>
                      <span>{fmtCHF(total)}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Reference + notes */}
              {(invoice.reference || invoice.notes) && (
                <div className="space-y-2">
                  {invoice.reference && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-[var(--muted)] w-24 shrink-0">Referenz</span>
                      <span className="font-mono text-[var(--foreground)]">{invoice.reference}</span>
                    </div>
                  )}
                  {invoice.notes && (
                    <div className="flex items-start gap-2 text-xs">
                      <span className="text-[var(--muted)] w-24 shrink-0 mt-0.5">Bemerkung</span>
                      <span className="text-[var(--text-2)]">{invoice.notes}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Right: status + actions */}
            <div className="space-y-4">
              {/* Payment info (for paid) */}
              {invoice.status === "Bezahlt" && invoice.paidDate && (
                <div className="rounded-lg border border-[var(--sce-success-light)] bg-[var(--sce-success-light)] px-4 py-3">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle className="h-4 w-4 text-[var(--sce-success)]" />
                    <p className="text-xs font-semibold text-[var(--sce-success)]">Bezahlt</p>
                  </div>
                  <p className="text-xs text-[var(--sce-success)]">{invoice.paidDate}</p>
                  {invoice.paymentMethod && (
                    <p className="text-[0.65rem] text-[var(--sce-success)] opacity-80 mt-0.5">
                      {invoice.paymentMethod}
                    </p>
                  )}
                </div>
              )}

              {/* Activity placeholder */}
              <div>
                <p className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Aktivität
                </p>
                <div className="space-y-2">
                  {[
                    invoice.status === "Bezahlt"
                      ? { icon: CheckCircle, text: `Zahlung eingegangen (${invoice.paidDate ?? ""})`, color: "text-[var(--sce-success)]" }
                      : null,
                    { icon: ChevronRight, text: `Erstellt am ${invoice.issueDate}`, color: "text-[var(--muted)]" },
                  ]
                    .filter(Boolean)
                    .map((item, i) => {
                      if (!item) return null;
                      const Icon = item.icon;
                      return (
                        <div key={i} className="flex items-start gap-2 text-xs">
                          <Icon className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${item.color}`} />
                          <span className="text-[var(--text-2)]">{item.text}</span>
                        </div>
                      );
                    })}
                </div>
              </div>

              {/* Actions */}
              <div>
                <p className="mb-1.5 text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                  Aktionen
                </p>
                <div className="space-y-2">
                  {MOCKED_ACTIONS.filter((a) =>
                    (a.onlyStatuses as readonly string[]).includes(invoice.status),
                  ).map((action) => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.label}
                        type="button"
                        disabled
                        title="Demnächst verfügbar"
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg border px-3 py-2 text-xs font-medium cursor-not-allowed",
                          "border-[var(--border)] bg-[var(--surface-2)] text-[var(--muted)] opacity-60",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1 text-left">{action.label}</span>
                        <Badge variant="warning" size="sm">Demnächst</Badge>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Demo notice */}
              <div className="rounded-lg border border-[var(--sce-warning-light)] bg-[var(--sce-warning-light)] px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 text-[var(--sce-warning)] mt-0.5" />
                  <p className="text-[0.65rem] text-[var(--sce-warning)] leading-relaxed">
                    <span className="font-semibold">Demo-Ansicht.</span>{" "}
                    Keine echten Aktionen — alle Funktionen sind In Entwicklung.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
          <Button variant="secondary" size="sm" onClick={onClose}>
            Schließen
          </Button>
        </div>
      </div>
    </div>
  );
}
