"use client";

import {
  AlertCircle,
  ChevronRight,
  FileText,
  Plus,
  Search,
  X,
} from "lucide-react";
import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { DashboardKpiCard } from "@/components/ui/dashboard/DashboardKpiCard";
import { SectionCard } from "@/components/ui/page";
import {
  type Invoice,
  type InvoiceStatus,
  type RecipientType,
  DEMO_INVOICES,
  INVOICE_STATUS_CONFIG,
  RECIPIENT_TYPE_OPTIONS,
  fmtCHF,
} from "./rechnungen-data";
import { InvoiceDetailDialog } from "./InvoiceDetailDialog";
import { NeueRechnungDialog } from "./NeueRechnungDialog";
import { cn } from "@/lib/cn";

const ALL_STATUSES: InvoiceStatus[] = [
  "Entwurf",
  "Offen",
  "Überfällig",
  "Bezahlt",
  "Storniert",
];

export function RechnungenView() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<InvoiceStatus | "">("");
  const [typeFilter, setTypeFilter] = useState<RecipientType | "">("");
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showNeueRechnung, setShowNeueRechnung] = useState(false);
  // Incremented each time we open the dialog, forces a fresh remount.
  const [neueRechnungKey, setNeueRechnungKey] = useState(0);

  // ── Summary KPIs ────────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    const open      = DEMO_INVOICES.filter((i) => i.status === "Offen");
    const overdue   = DEMO_INVOICES.filter((i) => i.status === "Überfällig");
    const paid      = DEMO_INVOICES.filter((i) => i.status === "Bezahlt");
    const drafts    = DEMO_INVOICES.filter((i) => i.status === "Entwurf");
    return {
      openTotal:    open.reduce((s, i) => s + i.amount, 0),
      openCount:    open.length,
      overdueTotal: overdue.reduce((s, i) => s + i.amount, 0),
      overdueCount: overdue.length,
      paidTotal:    paid.reduce((s, i) => s + i.amount, 0),
      paidCount:    paid.length,
      draftCount:   drafts.length,
    };
  }, []);

  // ── Filtered list ───────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    return DEMO_INVOICES.filter((inv) => {
      if (statusFilter && inv.status !== statusFilter) return false;
      if (typeFilter   && inv.recipientType !== typeFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !inv.number.toLowerCase().includes(q) &&
          !inv.recipient.toLowerCase().includes(q) &&
          !inv.subject.toLowerCase().includes(q)
        ) return false;
      }
      return true;
    });
  }, [search, statusFilter, typeFilter]);

  const hasActiveFilters = search || statusFilter || typeFilter;

  return (
    <>
      {/* Demo notice */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-[var(--sce-warning-light)] bg-[var(--sce-warning-light)] px-4 py-3">
        <AlertCircle className="h-4 w-4 shrink-0 text-[var(--sce-warning)] mt-0.5" />
        <p className="text-xs text-[var(--sce-warning)] leading-relaxed">
          <span className="font-semibold">Demo-Ansicht · In Entwicklung.</span>{" "}
          Alle Rechnungsdaten sind Demodaten. Keine Persistenz, keine Zahlungsintegration, keine PDF-Generierung.
          Dieses Modul berührt nicht die Personen-Finanzen.
        </p>
      </div>

      {/* KPI summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-6">
        <DashboardKpiCard
          title="Offen"
          value={fmtCHF(summary.openTotal)}
          description={`${summary.openCount} Rechnung(en)`}
          accent="primary"
          icon={<FileText className="h-5 w-5" />}
        />
        <DashboardKpiCard
          title="Überfällig"
          value={fmtCHF(summary.overdueTotal)}
          description={`${summary.overdueCount} Rechnung(en)`}
          accent="danger"
          icon={<AlertCircle className="h-5 w-5" />}
        />
        <DashboardKpiCard
          title="Bezahlt (YTD)"
          value={fmtCHF(summary.paidTotal)}
          description={`${summary.paidCount} Rechnung(en)`}
          accent="success"
          icon={<FileText className="h-5 w-5" />}
        />
        <DashboardKpiCard
          title="Entwürfe"
          value={String(summary.draftCount)}
          description="ausstehend"
          accent="warning"
          icon={<FileText className="h-5 w-5" />}
        />
      </div>

      {/* Invoice list */}
      <SectionCard
        title="Rechnungsübersicht"
        description={`${filtered.length} von ${DEMO_INVOICES.length} Rechnungen`}
        noPadding
        headerActions={
          <Button
            variant="primary"
            size="sm"
            iconLeft={<Plus className="h-4 w-4" />}
            onClick={() => { setShowNeueRechnung(true); setNeueRechnungKey((k) => k + 1); }}
          >
            Neue Rechnung
          </Button>
        }
      >
        {/* Search + filter bar */}
        <div className="flex flex-wrap items-center gap-2 border-b border-[var(--border)] px-4 py-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[160px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[var(--muted)]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Suchen nach Nummer, Empfänger…"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] pl-8 pr-3 py-1.5 text-xs focus:border-[var(--sce-primary)] focus:outline-none"
            />
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as InvoiceStatus | "")}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-2)] focus:border-[var(--sce-primary)] focus:outline-none"
          >
            <option value="">Alle Status</option>
            {ALL_STATUSES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          {/* Type filter */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value as RecipientType | "")}
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs text-[var(--text-2)] focus:border-[var(--sce-primary)] focus:outline-none"
          >
            <option value="">Alle Typen</option>
            {RECIPIENT_TYPE_OPTIONS.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => { setSearch(""); setStatusFilter(""); setTypeFilter(""); }}
              className="flex items-center gap-1 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
            >
              <X className="h-3 w-3" />
              Filter löschen
            </button>
          )}
        </div>

        {/* Table */}
        {filtered.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="px-4 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Nr.
                  </th>
                  <th className="px-4 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Empfänger
                  </th>
                  <th className="hidden px-4 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] sm:table-cell">
                    Typ
                  </th>
                  <th className="hidden px-4 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] md:table-cell">
                    Datum
                  </th>
                  <th className="hidden px-4 py-2.5 text-left text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] lg:table-cell">
                    Fällig
                  </th>
                  <th className="px-4 py-2.5 text-right text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Betrag
                  </th>
                  <th className="px-4 py-2.5 text-center text-[0.65rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">
                    Status
                  </th>
                  <th className="px-4 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {filtered.map((inv) => {
                  const statusCfg = INVOICE_STATUS_CONFIG[inv.status];
                  return (
                    <tr
                      key={inv.id}
                      className="group cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                      onClick={() => setSelectedInvoice(inv)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-semibold text-[var(--foreground)]">
                          {inv.number}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-medium text-[var(--foreground)] leading-tight">{inv.recipient}</p>
                        <p className="text-[0.65rem] text-[var(--muted)] mt-0.5 leading-tight truncate max-w-[180px]">
                          {inv.subject}
                        </p>
                      </td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <Badge variant="default" size="sm">{inv.recipientType}</Badge>
                      </td>
                      <td className="hidden px-4 py-3 text-[var(--text-2)] md:table-cell">
                        {inv.issueDate}
                      </td>
                      <td className={cn(
                        "hidden px-4 py-3 lg:table-cell",
                        inv.status === "Überfällig" ? "text-[var(--sce-danger)] font-semibold" : "text-[var(--text-2)]",
                      )}>
                        {inv.dueDate}
                        {inv.status === "Überfällig" && (
                          <AlertCircle className="ml-1 inline h-3 w-3" />
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-[var(--foreground)]">
                        {fmtCHF(inv.amount)}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <Badge variant={statusCfg.variant} size="sm">
                          {inv.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <ChevronRight className="h-4 w-4 text-[var(--muted)] group-hover:text-[var(--foreground)] transition-colors" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <FileText className="h-10 w-10 text-[var(--muted)] mb-3" />
            <p className="text-sm font-medium text-[var(--foreground)]">Keine Rechnungen gefunden</p>
            <p className="text-xs text-[var(--muted)] mt-1">Passen Sie die Filter an oder erstellen Sie eine neue Rechnung.</p>
          </div>
        )}

        {/* Footer badge */}
        <div className="flex items-center gap-2 border-t border-[var(--border)] px-4 py-2.5">
          <Badge variant="warning" size="sm">In Entwicklung</Badge>
          <p className="text-[0.68rem] text-[var(--muted)]">Demo-Rechnungen — keine Persistenz</p>
        </div>
      </SectionCard>

      {/* Dialogs */}
      <InvoiceDetailDialog
        invoice={selectedInvoice}
        onClose={() => setSelectedInvoice(null)}
      />
      <NeueRechnungDialog
        key={neueRechnungKey}
        open={showNeueRechnung}
        onClose={() => setShowNeueRechnung(false)}
      />
    </>
  );
}
