"use client";

import {
  AlertCircle,
  Building2,
  Check,
  ChevronRight,
  CreditCard,
  FileText,
  Layers,
  Minus,
  Plus,
  User,
  Users,
  X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import {
  type RecipientType,
  type InvoicePosition,
  DEMO_RECIPIENTS,
  RECIPIENT_TYPE_OPTIONS,
  calcInvoiceTotals,
  fmtCHF,
} from "./rechnungen-data";
import { cn } from "@/lib/cn";

// ── Types ──────────────────────────────────────────────────────────────────────

type DraftPosition = {
  id: string;
  bezeichnung: string;
  menge: string;        // string for controlled input
  einzelpreis: string;  // string for controlled input
  mwstPct: string;      // string for controlled input, empty = no VAT
};

type DraftInvoice = {
  recipientType: RecipientType | "";
  recipient: string;
  subject: string;
  reference: string;
  notes: string;
  issueDate: string;
  dueDate: string;
  positions: DraftPosition[];
};

const INITIAL_DRAFT: DraftInvoice = {
  recipientType: "",
  recipient: "",
  subject: "",
  reference: "",
  notes: "",
  issueDate: "",
  dueDate: "",
  positions: [
    { id: "new-1", bezeichnung: "", menge: "1", einzelpreis: "", mwstPct: "" },
  ],
};

const STEPS = [
  { num: 1, label: "Empfängertyp",    icon: Users },
  { num: 2, label: "Empfänger",       icon: User  },
  { num: 3, label: "Rechnungsdaten",  icon: FileText },
  { num: 4, label: "Positionen",      icon: Layers },
  { num: 5, label: "Fälligkeit",      icon: CreditCard },
  { num: 6, label: "Zusammenfassung", icon: Check },
] as const;

const RECIPIENT_TYPE_META: Record<RecipientType, { icon: typeof User; description: string }> = {
  "Mitglied":      { icon: User,      description: "Einzelne Vereinsmitglieder, z. B. für Jahresbeiträge" },
  "Sponsor":       { icon: Building2, description: "Externe Unternehmen mit Sponsoringvertrag"            },
  "Partner":       { icon: Building2, description: "Dienstleister und Kooperationspartner des Vereins"     },
  "Team / Gruppe": { icon: Users,     description: "Mannschaften oder interne Gruppen"                    },
  "Sonstige":      { icon: FileText,  description: "Alle übrigen Empfänger (Gemeinde, Verbände, etc.)"    },
};

function newPosition(): DraftPosition {
  return { id: `new-${Date.now()}`, bezeichnung: "", menge: "1", einzelpreis: "", mwstPct: "" };
}

function draftPositionToCalc(pos: DraftPosition): InvoicePosition {
  return {
    id: pos.id,
    bezeichnung: pos.bezeichnung,
    menge: parseFloat(pos.menge) || 0,
    einzelpreis: parseFloat(pos.einzelpreis) || 0,
    mwstPct: pos.mwstPct ? parseFloat(pos.mwstPct) : undefined,
  };
}

// ── Component ──────────────────────────────────────────────────────────────────

type Props = {
  open: boolean;
  onClose: () => void;
};

export function NeueRechnungDialog({ open, onClose }: Props) {
  const [step, setStep] = useState(1);
  const [draft, setDraft] = useState<DraftInvoice>(INITIAL_DRAFT);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onClose(); }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const calcPositions = draft.positions.map(draftPositionToCalc);
  const { subtotal, totalVat, total } = calcInvoiceTotals(calcPositions);

  function updateDraft(patch: Partial<DraftInvoice>) {
    setDraft((prev) => ({ ...prev, ...patch }));
  }

  function addPosition() {
    updateDraft({ positions: [...draft.positions, newPosition()] });
  }

  function removePosition(id: string) {
    if (draft.positions.length <= 1) return;
    updateDraft({ positions: draft.positions.filter((p) => p.id !== id) });
  }

  function updatePosition(id: string, patch: Partial<DraftPosition>) {
    updateDraft({
      positions: draft.positions.map((p) => (p.id === id ? { ...p, ...patch } : p)),
    });
  }

  const canNext =
    (step === 1 && draft.recipientType !== "") ||
    (step === 2 && draft.recipient !== "") ||
    (step === 3 && draft.subject !== "") ||
    (step === 4 && draft.positions.some((p) => p.bezeichnung && p.einzelpreis)) ||
    (step === 5 && draft.dueDate !== "") ||
    step === 6;

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
        aria-labelledby="neue-rechnung-title"
        tabIndex={-1}
        className={cn(
          "relative z-10 flex w-full max-w-2xl flex-col",
          "max-h-[92vh] overflow-hidden",
          "rounded-2xl border border-[var(--border)] bg-[var(--surface)]",
          "shadow-[var(--shadow-xl)] outline-none",
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-[var(--border)] px-6 py-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 id="neue-rechnung-title" className="text-base font-semibold text-[var(--foreground)]">
                Neue Rechnung
              </h2>
              <Badge variant="warning" size="sm">In Entwicklung</Badge>
            </div>
            <p className="mt-0.5 text-xs text-[var(--text-2)]">
              Schritt {step} von {STEPS.length} · {STEPS[step - 1].label}
            </p>
          </div>
          <button
            type="button"
            aria-label="Schließen"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-[var(--text-2)] hover:bg-[var(--surface-2)] hover:text-[var(--foreground)] transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step indicator */}
        <div className="flex border-b border-[var(--border)] bg-[var(--surface-2)] px-6 py-3 gap-1 overflow-x-auto">
          {STEPS.map((s) => {
            const Icon = s.icon;
            const done = s.num < step;
            const active = s.num === step;
            return (
              <div
                key={s.num}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium min-w-0",
                  done  && "text-[var(--sce-success)]",
                  active && "bg-[var(--surface)] text-[var(--foreground)] shadow-sm",
                  !done && !active && "text-[var(--muted)]",
                )}
              >
                {done ? (
                  <Check className="h-3.5 w-3.5 shrink-0" />
                ) : (
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                )}
                <span className="hidden sm:inline truncate">{s.label}</span>
                <span className="sm:hidden">{s.num}</span>
              </div>
            );
          })}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* STEP 1: Empfängertyp */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">Empfängertyp wählen</p>
              <p className="text-xs text-[var(--text-2)]">
                Welche Art von Empfänger soll diese Rechnung erhalten?
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {RECIPIENT_TYPE_OPTIONS.map((type) => {
                  const { icon: Icon, description } = RECIPIENT_TYPE_META[type];
                  const selected = draft.recipientType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => updateDraft({ recipientType: type, recipient: "" })}
                      className={cn(
                        "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                        selected
                          ? "border-[var(--sce-primary)] bg-[var(--sce-primary-light)]"
                          : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--sce-primary)] hover:bg-[var(--sce-primary-light)]",
                      )}
                    >
                      <div
                        className={cn(
                          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          selected ? "bg-[var(--sce-primary)] text-white" : "bg-[var(--surface)] text-[var(--text-2)]",
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div>
                        <p className={cn("text-sm font-semibold", selected ? "text-[var(--sce-primary)]" : "text-[var(--foreground)]")}>
                          {type}
                        </p>
                        <p className="text-xs text-[var(--text-2)] mt-0.5 leading-relaxed">{description}</p>
                      </div>
                      {selected && (
                        <Check className="ml-auto h-4 w-4 shrink-0 text-[var(--sce-primary)]" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* STEP 2: Empfänger */}
          {step === 2 && draft.recipientType && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-[var(--foreground)]">Empfänger wählen</p>
              <p className="text-xs text-[var(--text-2)]">
                Empfängertyp: <span className="font-medium text-[var(--foreground)]">{draft.recipientType}</span>
              </p>
              <div className="space-y-1.5">
                {DEMO_RECIPIENTS[draft.recipientType as RecipientType].map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => updateDraft({ recipient: name })}
                    className={cn(
                      "flex w-full items-center gap-3 rounded-lg border px-4 py-3 text-left transition-colors",
                      draft.recipient === name
                        ? "border-[var(--sce-primary)] bg-[var(--sce-primary-light)]"
                        : "border-[var(--border)] bg-[var(--surface-2)] hover:border-[var(--sce-primary)]",
                    )}
                  >
                    <div className={cn(
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                      draft.recipient === name
                        ? "bg-[var(--sce-primary)] text-white"
                        : "bg-[var(--surface)] text-[var(--muted)] border border-[var(--border)]",
                    )}>
                      {name.charAt(0)}
                    </div>
                    <span className={cn("text-sm font-medium", draft.recipient === name ? "text-[var(--sce-primary)]" : "text-[var(--foreground)]")}>
                      {name}
                    </span>
                    {draft.recipient === name && (
                      <Check className="ml-auto h-4 w-4 shrink-0 text-[var(--sce-primary)]" />
                    )}
                  </button>
                ))}
                {/* Freie Eingabe */}
                <div className="pt-1">
                  <label className="block text-xs text-[var(--muted)] mb-1">Oder freie Eingabe:</label>
                  <input
                    type="text"
                    value={draft.recipient}
                    onChange={(e) => updateDraft({ recipient: e.target.value })}
                    placeholder="Name / Firma eingeben..."
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--sce-primary)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Rechnungsdaten */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Rechnungsdaten</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1">
                    Betreff / Bezeichnung <span className="text-[var(--sce-danger)]">*</span>
                  </label>
                  <input
                    type="text"
                    value={draft.subject}
                    onChange={(e) => updateDraft({ subject: e.target.value })}
                    placeholder="z. B. Mitgliederbeitrag Saison 2026/27"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1">
                    Rechnungsdatum
                  </label>
                  <input
                    type="date"
                    value={draft.issueDate}
                    onChange={(e) => updateDraft({ issueDate: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1">
                    Interne Referenz
                  </label>
                  <input
                    type="text"
                    value={draft.reference}
                    onChange={(e) => updateDraft({ reference: e.target.value })}
                    placeholder="z. B. MB-2026-001"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1">
                    Bemerkung / Beschreibung
                  </label>
                  <textarea
                    value={draft.notes}
                    onChange={(e) => updateDraft({ notes: e.target.value })}
                    placeholder="Optionale Zusatzinformationen für den Empfänger..."
                    rows={3}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm resize-none focus:border-[var(--sce-primary)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          )}

          {/* STEP 4: Positionen */}
          {step === 4 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--foreground)]">Rechnungspositionen</p>
                <button
                  type="button"
                  onClick={addPosition}
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-medium text-[var(--text-2)] hover:text-[var(--foreground)] transition-colors"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Position hinzufügen
                </button>
              </div>

              <div className="space-y-3">
                {draft.positions.map((pos, idx) => (
                  <div
                    key={pos.id}
                    className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">
                        Position {idx + 1}
                      </span>
                      {draft.positions.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removePosition(pos.id)}
                          className="rounded-md p-1 text-[var(--muted)] hover:text-[var(--sce-danger)] hover:bg-[var(--sce-danger-light)] transition-colors"
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Bezeichnung</label>
                      <input
                        type="text"
                        value={pos.bezeichnung}
                        onChange={(e) => updatePosition(pos.id, { bezeichnung: e.target.value })}
                        placeholder="z. B. Mitgliederbeitrag Aktiv"
                        className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-2)] mb-1">Menge</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={pos.menge}
                          onChange={(e) => updatePosition(pos.id, { menge: e.target.value })}
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-2)] mb-1">
                          Einzelpreis CHF
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={pos.einzelpreis}
                          onChange={(e) => updatePosition(pos.id, { einzelpreis: e.target.value })}
                          placeholder="0.00"
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-[var(--text-2)] mb-1">
                          MwSt. %
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.1"
                          value={pos.mwstPct}
                          onChange={(e) => updatePosition(pos.id, { mwstPct: e.target.value })}
                          placeholder="z. B. 8.1"
                          className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
                        />
                      </div>
                    </div>
                    {/* Live line total */}
                    {pos.einzelpreis && (
                      <div className="flex justify-end text-xs text-[var(--text-2)]">
                        <span className="font-semibold text-[var(--foreground)]">
                          = {fmtCHF(
                            (parseFloat(pos.menge) || 0) *
                            (parseFloat(pos.einzelpreis) || 0) *
                            (1 + (parseFloat(pos.mwstPct) || 0) / 100),
                          )}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Live total */}
              {total > 0 && (
                <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3 space-y-1.5">
                  <div className="flex justify-between text-xs text-[var(--text-2)]">
                    <span>Zwischensumme</span>
                    <span>{fmtCHF(subtotal)}</span>
                  </div>
                  {totalVat > 0 && (
                    <div className="flex justify-between text-xs text-[var(--text-2)]">
                      <span>MwSt.</span>
                      <span>{fmtCHF(totalVat)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-[var(--border)] pt-1.5 text-sm font-bold text-[var(--foreground)]">
                    <span>Total CHF</span>
                    <span>{fmtCHF(total)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 5: Fälligkeit */}
          {step === 5 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Fälligkeit & Zahlungskonditionen</p>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-[var(--text-2)] mb-1">
                    Fälligkeitsdatum <span className="text-[var(--sce-danger)]">*</span>
                  </label>
                  <input
                    type="date"
                    value={draft.dueDate}
                    onChange={(e) => updateDraft({ dueDate: e.target.value })}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm focus:border-[var(--sce-primary)] focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {["30 Tage netto", "60 Tage netto", "Sofort fällig"].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      className="rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-medium text-[var(--text-2)] hover:border-[var(--sce-primary)] hover:text-[var(--foreground)] transition-colors"
                      onClick={() => {
                        const today = new Date();
                        const days = preset === "30 Tage netto" ? 30 : preset === "60 Tage netto" ? 60 : 0;
                        today.setDate(today.getDate() + days);
                        updateDraft({ dueDate: today.toISOString().split("T")[0] });
                      }}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
                <div className="rounded-lg border border-[var(--sce-info-light)] bg-[var(--sce-info-light)] px-4 py-3">
                  <p className="text-xs text-[var(--sce-info)]">
                    Zahlungserinnerungen und automatischer Mahnlauf: <span className="font-semibold">In Entwicklung</span>
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 6: Zusammenfassung */}
          {step === 6 && (
            <div className="space-y-4">
              <p className="text-sm font-semibold text-[var(--foreground)]">Zusammenfassung</p>

              <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-2)] divide-y divide-[var(--border)]">
                <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="text-[var(--muted)]">Empfängertyp</span>
                  <span className="font-medium text-[var(--foreground)]">{draft.recipientType}</span>
                </div>
                <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="text-[var(--muted)]">Empfänger</span>
                  <span className="font-medium text-[var(--foreground)]">{draft.recipient || "—"}</span>
                </div>
                <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="text-[var(--muted)]">Betreff</span>
                  <span className="font-medium text-[var(--foreground)]">{draft.subject || "—"}</span>
                </div>
                <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="text-[var(--muted)]">Rechnungsdatum</span>
                  <span className="font-medium text-[var(--foreground)]">{draft.issueDate || "—"}</span>
                </div>
                <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="text-[var(--muted)]">Fällig am</span>
                  <span className="font-medium text-[var(--foreground)]">{draft.dueDate || "—"}</span>
                </div>
                <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="text-[var(--muted)]">Positionen</span>
                  <span className="font-medium text-[var(--foreground)]">{draft.positions.filter(p => p.bezeichnung).length} Position(en)</span>
                </div>
                <div className="px-4 py-3 grid grid-cols-2 gap-2 text-xs">
                  <span className="text-[var(--muted)]">Total CHF</span>
                  <span className="font-bold text-[var(--foreground)]">{fmtCHF(total)}</span>
                </div>
              </div>

              {/* Demnächst notice — prominently placed */}
              <div className="rounded-xl border-2 border-[var(--sce-warning)] bg-[var(--sce-warning-light)] px-5 py-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 shrink-0 text-[var(--sce-warning)] mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-[var(--sce-warning)]">
                      Speichern noch nicht möglich · In Entwicklung
                    </p>
                    <p className="mt-1 text-xs text-[var(--sce-warning)] leading-relaxed">
                      Das Fakturierungsmodul befindet sich in Entwicklung. Rechnungen werden in dieser Demo
                      nicht gespeichert, versendet oder verbucht. Diese Vorschau zeigt, wie die Erfassung
                      künftig funktionieren wird.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 border-t border-[var(--border)] px-6 py-4">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => (step > 1 ? setStep((s) => s - 1) : onClose())}
          >
            {step > 1 ? "Zurück" : "Abbrechen"}
          </Button>
          <div className="flex items-center gap-2">
            {step < STEPS.length ? (
              <Button
                variant="primary"
                size="sm"
                disabled={!canNext}
                onClick={() => setStep((s) => s + 1)}
                iconRight={<ChevronRight className="h-4 w-4" />}
              >
                Weiter
              </Button>
            ) : (
              <button
                type="button"
                disabled
                title="Demnächst verfügbar — keine Persistenz in dieser Demo"
                className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--muted)] cursor-not-allowed opacity-60"
              >
                Rechnung speichern
                <Badge variant="warning" size="sm">Demnächst</Badge>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
