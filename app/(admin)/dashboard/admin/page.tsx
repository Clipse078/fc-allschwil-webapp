import Link from "next/link";
import { Network, Settings, ShieldCheck, UsersRound, Workflow } from "lucide-react";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { DEFAULT_FC_ALLSCHWIL_CONFIG } from "@/lib/admin/club-config";

export default async function AdminConfigurationPage() {
  await requirePermission(PERMISSIONS.USERS_MANAGE);

  const config = DEFAULT_FC_ALLSCHWIL_CONFIG;

  return (
    <div className="space-y-8">
      <AdminSectionHeader
        eyebrow="Admin"
        title="Club-Konfiguration"
        description="Zentrale Steuerung für Vereinsregeln, Rollen, Workflows, Teamlogik und spätere Mandanten-Konfiguration."
      />

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="fca-eyebrow">Tenant</p>
            <h2 className="mt-2 text-2xl font-black text-[#0b4aa2]">{config.clubName}</h2>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              {config.countryCode} · {config.federationLabel} · Saison {config.seasonLabel}
            </p>
          </div>
          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-xs font-black uppercase tracking-[0.08em] text-emerald-700">
            Konfiguration aktiv
          </span>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-4">
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <Settings className="h-6 w-6 text-[#0b4aa2]" />
          <h3 className="mt-4 font-black text-slate-900">Teamregeln</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">Jahrgänge, Kategorien, Traineranzahl und Diplomlogik pro Verein.</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <ShieldCheck className="h-6 w-6 text-[#0b4aa2]" />
          <h3 className="mt-4 font-black text-slate-900">Rollen & Rechte</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">Rollen definieren, Benutzern zuweisen und Zugriffe steuern.</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <Workflow className="h-6 w-6 text-[#0b4aa2]" />
          <h3 className="mt-4 font-black text-slate-900">Workflows</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">Vorbereiten, Review, Freigabe und Veröffentlichung konfigurieren.</p>
        </div>
        <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm">
          <Network className="h-6 w-6 text-[#0b4aa2]" />
          <h3 className="mt-4 font-black text-slate-900">Organigramm</h3>
          <p className="mt-2 text-sm leading-6 text-slate-500">Clubstruktur künftig aus Admin statt Vereinsleitung steuern.</p>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="fca-eyebrow">Regelgrundlage</p>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {config.teamCategoryRules.map((rule) => (
            <div key={rule.key} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <h3 className="font-black text-slate-900">{rule.label}</h3>
              <div className="mt-4 flex flex-wrap gap-2">
                <span className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold text-[#0b4aa2]">
                  {rule.minimumTrainerCount} Trainer
                </span>
                {rule.requiredDiplomaLabels.map((diploma) => (
                  <span key={diploma} className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    {diploma}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm">
        <p className="fca-eyebrow">Workflow-Vorlagen</p>
        <div className="mt-5 space-y-3">
          {config.workflowRules.map((workflow) => (
            <div key={workflow.key} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="font-black text-slate-900">{workflow.label}</h3>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{workflow.domain}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full border border-blue-100 bg-white px-3 py-1 text-xs font-bold text-[#0b4aa2]">
                    Vorbereitung: {workflow.preparerRoleKeys.join(", ")}
                  </span>
                  <span className="rounded-full border border-amber-100 bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                    Review: {workflow.reviewerRoleKeys.join(", ")}
                  </span>
                  <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-700">
                    Publishing: {workflow.publisherRoleKeys.join(", ")}
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <Link href="/dashboard/users" className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <UsersRound className="h-6 w-6 text-[#0b4aa2]" />
          <h3 className="mt-4 font-black text-slate-900">Rollen & Benutzer öffnen</h3>
        </Link>
        <Link href="/vereinsleitung/organigramm" className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
          <Network className="h-6 w-6 text-[#0b4aa2]" />
          <h3 className="mt-4 font-black text-slate-900">Organigramm öffnen</h3>
        </Link>
      </section>
    </div>
  );
}
