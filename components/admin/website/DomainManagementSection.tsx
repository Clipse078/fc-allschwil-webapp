"use client";

import { useState, useTransition } from "react";
import { CheckCircle2, Globe, Info, Lightbulb, Shield } from "lucide-react";
import {
  updateDomainSettings,
  superadminVerifyDomain,
  type DomainResult,
} from "@/app/(admin)/dashboard/website/settings/actions";

type Props = {
  siteId: string;
  tenantKey: string;
  initialDomain: string;
  initialApexDomain: string;
  domainStatus: string;
  sslStatus: string;
  isSuperAdmin: boolean;
};

const DOMAIN_STATUS_LABELS: Record<string, string> = {
  NOT_CONFIGURED: "Nicht konfiguriert",
  DNS_PENDING: "DNS ausstehend",
  VERIFIED: "DNS verifiziert",
  LIVE: "Live",
  ERROR: "Fehler",
};
const DOMAIN_STATUS_STYLES: Record<string, string> = {
  NOT_CONFIGURED: "border-slate-200 bg-slate-50 text-slate-500",
  DNS_PENDING: "border-amber-200 bg-amber-50 text-amber-700",
  VERIFIED: "border-[#0b4aa2]/20 bg-[#0b4aa2]/5 text-[#0b4aa2]",
  LIVE: "border-emerald-200 bg-emerald-50 text-emerald-700",
  ERROR: "border-rose-200 bg-rose-50 text-rose-700",
};
const SSL_LABELS: Record<string, string> = {
  UNKNOWN: "Unbekannt",
  PENDING: "Ausstehend",
  ACTIVE: "Aktiv",
  ERROR: "Fehler",
};

export default function DomainManagementSection({
  siteId,
  tenantKey,
  initialDomain,
  initialApexDomain,
  domainStatus,
  sslStatus,
  isSuperAdmin: superAdmin,
}: Props) {
  const [domain, setDomain] = useState(initialDomain);
  const [apexDomain, setApexDomain] = useState(initialApexDomain);
  const [result, setResult] = useState<DomainResult | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSAVerifying, startSATransition] = useTransition();

  function handleSave() {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("domain", domain);
      fd.append("apexDomain", apexDomain);
      const r = await updateDomainSettings(fd);
      setResult(r);
    });
  }

  function handleSAVerify(ds: string, sl: string) {
    startSATransition(async () => {
      const fd = new FormData();
      fd.append("siteId", siteId);
      fd.append("domainStatus", ds);
      fd.append("sslStatus", sl);
      const r = await superadminVerifyDomain(fd);
      setResult(r);
    });
  }

  const base = "w-full rounded-[14px] border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[#0b4aa2] focus:ring-2 focus:ring-[#0b4aa2]/10";
  const hasDomain = domain.trim().length > 0;

  return (
    <div className="rounded-[20px] border border-slate-200/80 bg-white p-5 shadow-[0_4px_12px_rgba(15,23,42,0.03)]">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 text-[1rem] font-semibold text-slate-900">
            <Globe className="h-4 w-4 text-[#0b4aa2]" />
            Domain
          </h2>
          <p className="mt-0.5 text-[11px] text-slate-400">
            Verbinde deine eigene Domain mit dieser Website.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${DOMAIN_STATUS_STYLES[domainStatus] ?? ""}`}>
            {DOMAIN_STATUS_LABELS[domainStatus] ?? domainStatus}
          </span>
          {sslStatus !== "UNKNOWN" && (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-500">
              SSL: {SSL_LABELS[sslStatus] ?? sslStatus}
            </span>
          )}
        </div>
      </div>

      {/* Nudge */}
      <div className="mt-4 space-y-2">
        <div className="flex items-start gap-2 rounded-[12px] border border-[#0b4aa2]/10 bg-[#0b4aa2]/5 px-3 py-2">
          <Lightbulb className="mt-0.5 h-3 w-3 shrink-0 text-[#0b4aa2]" />
          <p className="text-[11px] text-slate-600">
            Verbinde deine Domain wenn die Website bereit ist. Deine bisherige Website bleibt bis zum DNS-Wechsel live.
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-[11px] font-semibold text-slate-500">
            Primäre Domain (www empfohlen)
          </label>
          <input
            className={`mt-1.5 h-10 ${base}`}
            value={domain}
            onChange={(e) => { setDomain(e.target.value.trim()); setResult(null); }}
            placeholder="www.meineclub.ch"
          />
          <p className="mt-1 text-[10px] text-slate-400">
            www-Subdomain → CNAME auf Plattform-Host. Empfohlen für einfachstes Setup.
          </p>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-slate-500">
            Apex-Domain (optional)
          </label>
          <input
            className={`mt-1.5 h-10 ${base}`}
            value={apexDomain}
            onChange={(e) => { setApexDomain(e.target.value.trim()); setResult(null); }}
            placeholder="meineclub.ch"
          />
          <p className="mt-1 text-[10px] text-slate-400">
            Root-Domain → A/ALIAS Record oder Redirect auf www. Abhängig vom DNS-Anbieter.
          </p>
        </div>
      </div>

      {/* DNS instructions */}
      {hasDomain && (
        <div className="mt-4 rounded-[14px] border border-slate-200 bg-slate-50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">DNS-Konfiguration</p>
          <div className="mt-3 space-y-2 font-mono text-[11px]">
            <div className="flex flex-col gap-1">
              <span className="font-semibold text-slate-600">www (CNAME)</span>
              <span className="text-slate-400">{domain} → [Plattform-Host wird nach Verifikation angezeigt]</span>
            </div>
            {apexDomain && (
              <div className="flex flex-col gap-1 border-t border-slate-200 pt-2">
                <span className="font-semibold text-slate-600">Apex / Root (A oder ALIAS)</span>
                <span className="text-slate-400">{apexDomain} → Redirect auf {domain} oder A-Record je nach Anbieter</span>
              </div>
            )}
          </div>
          <div className="mt-3 flex items-start gap-2 rounded-[10px] border border-amber-100 bg-amber-50/70 px-3 py-2">
            <Info className="mt-0.5 h-3 w-3 shrink-0 text-amber-500" />
            <p className="text-[11px] text-amber-800">
              Du behältst die Domain-Ownership. SportClubEvo benötigt nur einen DNS-Eintrag der auf die Plattform zeigt. DNS-Änderungen können 24–48h dauern.
            </p>
          </div>
        </div>
      )}

      {/* Fallback info */}
      <div className="mt-3 rounded-[12px] border border-slate-200 bg-slate-50 px-3 py-2">
        <p className="text-[10px] text-slate-400">
          Entwicklungs-Fallback: <span className="font-mono font-semibold">/{tenantKey}/</span> bleibt immer erreichbar.
        </p>
      </div>

      {/* Superadmin verification */}
      {superAdmin && (
        <div className="mt-4 rounded-[14px] border border-[#0b4aa2]/20 bg-[#0b4aa2]/5 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-3.5 w-3.5 text-[#0b4aa2]" />
            <p className="text-[11px] font-semibold text-[#0b4aa2]">Superadmin: DNS-Verifikation</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {(["DNS_PENDING", "VERIFIED", "LIVE", "ERROR"] as const).map((s) => (
              <button
                key={s}
                type="button"
                disabled={isSAVerifying}
                onClick={() => handleSAVerify(s, s === "LIVE" ? "ACTIVE" : s === "ERROR" ? "ERROR" : "PENDING")}
                className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold transition disabled:opacity-50 ${DOMAIN_STATUS_STYLES[s]}`}
              >
                → {DOMAIN_STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Save */}
      {result?.ok && (
        <div className="mt-3 flex items-center gap-2 rounded-[12px] border border-emerald-200 bg-emerald-50 px-3 py-2">
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
          <p className="text-[12px] text-emerald-800">Domain-Einstellungen gespeichert.</p>
        </div>
      )}
      {result && !result.ok && (
        <p className="mt-2 text-[12px] text-rose-600">{result.error}</p>
      )}
      <button
        type="button"
        onClick={handleSave}
        disabled={isPending}
        className="mt-3 rounded-full bg-[#0b4aa2] px-4 py-2 text-[12px] font-semibold text-white transition hover:bg-[#08357a] disabled:opacity-50"
      >
        {isPending ? "Speichern …" : "Domain speichern"}
      </button>
    </div>
  );
}
