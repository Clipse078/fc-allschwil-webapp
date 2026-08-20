import {
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Check,
  Clock,
  CreditCard,
  TrendingDown,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { PageShell, PageHeader, PageBreadcrumbs, SectionCard } from "@/components/ui/page";
import { DashboardKpiCard } from "@/components/ui/dashboard/DashboardKpiCard";

// ── Demo-only data — never persisted, never DB-backed ─────────────────────────

type TransactionStatus = "Bezahlt" | "Offen" | "Fällig" | "Geplant";

type BudgetCategory = {
  id: string;
  name: string;
  type: "income" | "expense";
  budgeted: number;
  actual: number;
  forecast: number;
};

type Transaction = {
  id: string;
  date: string;
  description: string;
  category: string;
  amount: number;
  type: "income" | "expense";
  status: TransactionStatus;
};

const BUDGET_CATEGORIES: BudgetCategory[] = [
  { id: "b1",  name: "Mitgliederbeiträge",    type: "income",  budgeted: 42000, actual: 38500, forecast: 41000 },
  { id: "b2",  name: "Sponsoring",            type: "income",  budgeted: 28000, actual: 22000, forecast: 25000 },
  { id: "b3",  name: "Turniere / Events",     type: "income",  budgeted: 8000,  actual: 3200,  forecast: 7500  },
  { id: "b4",  name: "Material",              type: "expense", budgeted: 12000, actual: 9800,  forecast: 11500 },
  { id: "b5",  name: "Infrastruktur",         type: "expense", budgeted: 18000, actual: 15200, forecast: 17800 },
  { id: "b6",  name: "Schiedsrichter",        type: "expense", budgeted: 9500,  actual: 7200,  forecast: 9200  },
  { id: "b7",  name: "Trainer",               type: "expense", budgeted: 24000, actual: 18600, forecast: 23500 },
  { id: "b8",  name: "Administration",        type: "expense", budgeted: 6500,  actual: 4900,  forecast: 6200  },
];

const TRANSACTIONS: Transaction[] = [
  { id: "tx1",  date: "14. Aug 2026", description: "Mitgliederbeiträge Q3", category: "Mitgliederbeiträge", amount: 9800,  type: "income",  status: "Bezahlt" },
  { id: "tx2",  date: "12. Aug 2026", description: "Hauptsponsor-Rechnung", category: "Sponsoring",          amount: 8000,  type: "income",  status: "Offen"   },
  { id: "tx3",  date: "10. Aug 2026", description: "Ballbestellung Saisonstart", category: "Material",       amount: 1240,  type: "expense", status: "Bezahlt" },
  { id: "tx4",  date: "08. Aug 2026", description: "Platzmietgebühr Aug", category: "Infrastruktur",         amount: 1500,  type: "expense", status: "Fällig"  },
  { id: "tx5",  date: "05. Aug 2026", description: "Schiedsrichter Saisonstart", category: "Schiedsrichter", amount: 640,   type: "expense", status: "Bezahlt" },
  { id: "tx6",  date: "01. Aug 2026", description: "Trainerhonorare Juli", category: "Trainer",              amount: 3200,  type: "expense", status: "Bezahlt" },
  { id: "tx7",  date: "28. Jul 2026", description: "Turniereinnahmen Heimturnier", category: "Turniere / Events", amount: 2100, type: "income", status: "Bezahlt" },
  { id: "tx8",  date: "20. Jul 2026", description: "Vereinsversicherung Jahresbeitrag", category: "Administration", amount: 1850, type: "expense", status: "Bezahlt" },
  { id: "tx9",  date: "15. Sep 2026", description: "Herbstturnier geplant", category: "Turniere / Events",   amount: 2800,  type: "income",  status: "Geplant" },
  { id: "tx10", date: "01. Sep 2026", description: "Platzmietgebühr Sep",   category: "Infrastruktur",       amount: 1500,  type: "expense", status: "Geplant" },
];

const statusConfig: Record<TransactionStatus, { variant: "success" | "warning" | "danger" | "default" | "info" }> = {
  Bezahlt: { variant: "success" },
  Offen:   { variant: "default" },
  Fällig:  { variant: "danger"  },
  Geplant: { variant: "info" },
};

function fmt(n: number) {
  return new Intl.NumberFormat("de-CH", { style: "currency", currency: "CHF", maximumFractionDigits: 0 }).format(n);
}

function varianceColor(budgeted: number, actual: number, type: "income" | "expense") {
  const diff = actual - budgeted;
  if (type === "income") {
    return diff >= 0 ? "text-[var(--sce-success)]" : "text-[var(--sce-danger)]";
  }
  return diff <= 0 ? "text-[var(--sce-success)]" : "text-[var(--sce-danger)]";
}

export default function FinanzenPage() {
  const incomeCategories = BUDGET_CATEGORIES.filter((c) => c.type === "income");
  const expenseCategories = BUDGET_CATEGORIES.filter((c) => c.type === "expense");

  const totalBudgetedIncome = incomeCategories.reduce((s, c) => s + c.budgeted, 0);
  const totalActualIncome   = incomeCategories.reduce((s, c) => s + c.actual, 0);
  const totalForecastIncome = incomeCategories.reduce((s, c) => s + c.forecast, 0);

  const totalBudgetedExpense = expenseCategories.reduce((s, c) => s + c.budgeted, 0);
  const totalActualExpense   = expenseCategories.reduce((s, c) => s + c.actual, 0);
  const totalForecastExpense = expenseCategories.reduce((s, c) => s + c.forecast, 0);

  const netActual = totalActualIncome - totalActualExpense;
  const openItems = TRANSACTIONS.filter((t) => ["Offen", "Fällig"].includes(t.status));

  return (
    <PageShell>
      <PageBreadcrumbs
        items={[
          { label: "Vereinsleitung", href: "/vereinsleitung" },
          { label: "Finanzen" },
        ]}
      />

      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          eyebrow="Club Entwicklung"
          title="Finanzen"
          description="Jahresbudget, Ist-Werte, Forecast und offene Posten für die Vereinsfinanzen im Überblick."
          badge={<Badge variant="warning">In Entwicklung</Badge>}
          className="mb-0"
        />
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled
            title="Demnächst verfügbar"
            className="flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2 text-sm font-medium text-[var(--muted)] cursor-not-allowed"
          >
            <BarChart3 className="h-4 w-4" />
            Bericht exportieren
            <Badge variant="warning" size="sm">Demnächst</Badge>
          </button>
        </div>
      </div>

      {/* Demo notice */}
      <div className="mb-6 flex items-start gap-3 rounded-xl border border-[var(--sce-warning-light)] bg-[var(--sce-warning-light)] px-4 py-3">
        <AlertCircle className="h-4 w-4 shrink-0 text-[var(--sce-warning)] mt-0.5" />
        <p className="text-xs text-[var(--sce-warning)] leading-relaxed">
          <span className="font-semibold">Demo-Ansicht · In Entwicklung.</span>{" "}
          Budget, Ist-Werte, Transaktionen und offene Posten sind Demodaten. Kein Buchhaltungsmodul, keine Zahlungsintegration. Dieses Modul berührt nicht die Personen-Finanzen.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 mb-8">
        <DashboardKpiCard
          title="Jahresbudget"
          value={fmt(totalBudgetedIncome)}
          accent="primary"
          icon={<Wallet className="h-5 w-5" />}
          description={`Einnahmen budgetiert ${new Date().getFullYear()}`}
        />
        <DashboardKpiCard
          title="Einnahmen Ist"
          value={fmt(totalActualIncome)}
          accent="success"
          icon={<ArrowUpRight className="h-5 w-5" />}
          description={`${Math.round((totalActualIncome / totalBudgetedIncome) * 100)}% des Budgets`}
        />
        <DashboardKpiCard
          title="Ausgaben Ist"
          value={fmt(totalActualExpense)}
          accent="warning"
          icon={<ArrowDownRight className="h-5 w-5" />}
          description={`${Math.round((totalActualExpense / totalBudgetedExpense) * 100)}% des Budgets`}
        />
        <DashboardKpiCard
          title="Saldo Ist"
          value={fmt(netActual)}
          accent={netActual >= 0 ? "success" : "danger"}
          icon={netActual >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
          description="Einnahmen minus Ausgaben"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          {/* Income table */}
          <SectionCard
            title="Einnahmen"
            description={`Budget: ${fmt(totalBudgetedIncome)} · Ist: ${fmt(totalActualIncome)} · Forecast: ${fmt(totalForecastIncome)}`}
            noPadding
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Kategorie</th>
                  <th className="px-4 py-2.5 text-right text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Budget</th>
                  <th className="px-4 py-2.5 text-right text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Ist</th>
                  <th className="hidden px-4 py-2.5 text-right text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] md:table-cell">Forecast</th>
                  <th className="hidden px-4 py-2.5 text-center text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] sm:table-cell">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {incomeCategories.map((cat) => {
                  const diff = cat.actual - cat.budgeted;
                  const pct = Math.round((cat.actual / cat.budgeted) * 100);
                  const isOver = cat.actual >= cat.budgeted;
                  return (
                    <tr key={cat.id} className="hover:bg-[var(--surface-2)]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ArrowUpRight className="h-3.5 w-3.5 text-[var(--sce-success)]" />
                          <span className="font-medium text-[var(--foreground)] text-xs">{cat.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-[var(--text-2)]">{fmt(cat.budgeted)}</td>
                      <td className="px-4 py-3 text-right text-xs font-semibold text-[var(--foreground)]">{fmt(cat.actual)}</td>
                      <td className="hidden px-4 py-3 text-right text-xs text-[var(--text-2)] md:table-cell">{fmt(cat.forecast)}</td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={isOver ? "success" : "warning"} size="sm">
                            {isOver ? "Im Budget" : `${diff < 0 ? "" : "+"}${fmt(diff)}`}
                          </Badge>
                          <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--surface-2)] border border-[var(--border)]">
                            <div
                              className="h-full rounded-full bg-[var(--sce-success)]"
                              style={{ width: `${Math.min(pct, 100)}%` }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </SectionCard>

          {/* Expense table */}
          <SectionCard
            title="Ausgaben"
            description={`Budget: ${fmt(totalBudgetedExpense)} · Ist: ${fmt(totalActualExpense)} · Forecast: ${fmt(totalForecastExpense)}`}
            noPadding
          >
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] bg-[var(--surface-2)]">
                  <th className="px-4 py-2.5 text-left text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Kategorie</th>
                  <th className="px-4 py-2.5 text-right text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Budget</th>
                  <th className="px-4 py-2.5 text-right text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)]">Ist</th>
                  <th className="hidden px-4 py-2.5 text-right text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] md:table-cell">Forecast</th>
                  <th className="hidden px-4 py-2.5 text-center text-[0.68rem] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] sm:table-cell">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[var(--border)]">
                {expenseCategories.map((cat) => {
                  const pct = Math.round((cat.actual / cat.budgeted) * 100);
                  const isUnder = cat.actual <= cat.budgeted;
                  return (
                    <tr key={cat.id} className="hover:bg-[var(--surface-2)]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <ArrowDownRight className="h-3.5 w-3.5 text-[var(--sce-warning)]" />
                          <span className="font-medium text-[var(--foreground)] text-xs">{cat.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right text-xs text-[var(--text-2)]">{fmt(cat.budgeted)}</td>
                      <td className={`px-4 py-3 text-right text-xs font-semibold ${varianceColor(cat.budgeted, cat.actual, "expense")}`}>{fmt(cat.actual)}</td>
                      <td className="hidden px-4 py-3 text-right text-xs text-[var(--text-2)] md:table-cell">{fmt(cat.forecast)}</td>
                      <td className="hidden px-4 py-3 sm:table-cell">
                        <div className="flex flex-col items-end gap-1">
                          <Badge variant={isUnder ? "success" : "danger"} size="sm">
                            {isUnder ? "Im Budget" : `Über Budget`}
                          </Badge>
                          <div className="h-1 w-16 overflow-hidden rounded-full bg-[var(--surface-2)] border border-[var(--border)]">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                                background: isUnder ? "var(--sce-success)" : "var(--sce-danger)",
                              }}
                            />
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <div className="border-t border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 flex items-center gap-2">
              <Badge variant="warning" size="sm">In Entwicklung</Badge>
              <p className="text-[0.7rem] text-[var(--muted)]">Demo-Daten — nicht produktiv</p>
            </div>
          </SectionCard>
        </div>

        {/* Right sidebar: transactions + open items */}
        <div className="space-y-6">
          {/* Open items */}
          {openItems.length > 0 && (
            <SectionCard title="Offene Posten" description={`${openItems.length} Positionen erfordern Aufmerksamkeit`}>
              <div className="space-y-2.5 mt-1">
                {openItems.map((tx) => (
                  <div
                    key={tx.id}
                    className={`flex items-start justify-between gap-3 rounded-lg border px-3 py-2.5 ${
                      tx.status === "Fällig"
                        ? "border-[var(--sce-danger-light)] bg-[var(--sce-danger-light)]"
                        : "border-[var(--border)] bg-[var(--surface)]"
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-[var(--foreground)] leading-tight">{tx.description}</p>
                      <p className="text-[0.65rem] text-[var(--muted)] mt-0.5">{tx.category} · {tx.date}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-xs font-semibold ${tx.type === "income" ? "text-[var(--sce-success)]" : "text-[var(--foreground)]"}`}>
                        {tx.type === "income" ? "+" : "-"}{fmt(tx.amount)}
                      </p>
                      <Badge variant={statusConfig[tx.status].variant} size="sm" className="mt-1">
                        {tx.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-center">
                <button
                  type="button"
                  disabled
                  className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-medium text-[var(--muted)] cursor-not-allowed"
                  title="Demnächst verfügbar"
                >
                  Alle offenen Posten
                  <Badge variant="warning" size="sm">Demnächst</Badge>
                </button>
              </div>
            </SectionCard>
          )}

          {/* Recent transactions */}
          <SectionCard title="Letzte Transaktionen" description="Neueste Bewegungen">
            <div className="space-y-2.5 mt-1">
              {TRANSACTIONS.slice(0, 8).map((tx) => (
                <div key={tx.id} className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    <div
                      className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                        tx.type === "income"
                          ? "bg-[var(--sce-success-light)] text-[var(--sce-success)]"
                          : "bg-[var(--sce-warning-light)] text-[var(--sce-warning)]"
                      }`}
                    >
                      {tx.type === "income"
                        ? <ArrowUpRight className="h-3 w-3" />
                        : <ArrowDownRight className="h-3 w-3" />
                      }
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-[var(--foreground)] leading-tight truncate">{tx.description}</p>
                      <p className="text-[0.65rem] text-[var(--muted)]">{tx.date}</p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-xs font-semibold ${tx.type === "income" ? "text-[var(--sce-success)]" : "text-[var(--foreground)]"}`}>
                      {tx.type === "income" ? "+" : "-"}{fmt(tx.amount)}
                    </p>
                    <span className="flex items-center justify-end gap-1 mt-0.5">
                      {tx.status === "Bezahlt" && <Check className="h-2.5 w-2.5 text-[var(--sce-success)]" />}
                      {tx.status === "Fällig" && <AlertCircle className="h-2.5 w-2.5 text-[var(--sce-danger)]" />}
                      {tx.status === "Geplant" && <Clock className="h-2.5 w-2.5 text-[var(--muted)]" />}
                      <span className={`text-[0.65rem] ${
                        tx.status === "Bezahlt" ? "text-[var(--sce-success)]"
                        : tx.status === "Fällig" ? "text-[var(--sce-danger)]"
                        : "text-[var(--muted)]"
                      }`}>{tx.status}</span>
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex items-center gap-2 border-t border-[var(--border)] pt-3">
              <Badge variant="warning" size="sm">In Entwicklung</Badge>
              <p className="text-[0.68rem] text-[var(--muted)]">Demo-Transaktionen</p>
            </div>
          </SectionCard>

          {/* Forecast summary */}
          <SectionCard title="Forecast Jahresabschluss">
            <div className="space-y-3 mt-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-2)]">Einnahmen Forecast</span>
                <span className="font-semibold text-[var(--sce-success)]">{fmt(totalForecastIncome)}</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-[var(--text-2)]">Ausgaben Forecast</span>
                <span className="font-semibold text-[var(--foreground)]">{fmt(totalForecastExpense)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-[var(--border)] pt-2.5 text-xs">
                <span className="font-semibold text-[var(--foreground)]">Saldo Forecast</span>
                <span className={`font-bold text-sm ${totalForecastIncome - totalForecastExpense >= 0 ? "text-[var(--sce-success)]" : "text-[var(--sce-danger)]"}`}>
                  {fmt(totalForecastIncome - totalForecastExpense)}
                </span>
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <CreditCard className="h-3 w-3 text-[var(--muted)]" />
                <p className="text-[0.65rem] text-[var(--muted)]">Forecast-Daten sind Demo-only</p>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </PageShell>
  );
}
