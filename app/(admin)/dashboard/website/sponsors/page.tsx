import Link from "next/link";
import { ArrowLeft, Award, Lightbulb } from "lucide-react";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { prisma } from "@/lib/db/prisma";
import { createSponsorEntry, toggleSponsorActive } from "./actions";

const SITE_TENANT_KEY = process.env.SITE_TENANT_KEY ?? "default";

async function getSponsorsData() {
  const site = await prisma.websiteSite.findUnique({ where: { tenantKey: SITE_TENANT_KEY }, select: { id: true } });
  if (!site) return [];
  return prisma.sponsorEntry.findMany({
    where: { siteId: site.id },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, logoUrl: true, websiteUrl: true, tier: true, isActive: true, sortOrder: true },
  });
}

export default async function SponsorsAdminPage() {
  await requireAnyPermission([PERMISSIONS.WEBSITE_MANAGE]);
  const sponsors = await getSponsorsData();
  const activeCount = sponsors.filter((s) => s.isActive).length;

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/dashboard/website" className="mt-1 flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 transition hover:bg-slate-50">
          <ArrowLeft className="h-3.5 w-3.5" />Website
        </Link>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Sponsoren</h1>
          <p className="mt-0.5 text-xs text-slate-400">{sponsors.length} Einträge · {activeCount} aktiv</p>
        </div>
      </div>

      {activeCount === 0 && (
        <div className="flex items-start gap-3 rounded-[18px] border border-amber-100 bg-amber-50/70 px-4 py-3">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
          <p className="text-[12px] text-amber-800">
            Sponsor-Sichtbarkeit kann dein Vereinsmarketing kommerziell stärken. Füge Partner hinzu und zeige sie auf Website, Infoboard und Sponsorenzeile.
          </p>
        </div>
      )}

      {/* Create form */}
      <section className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-sm">
        <h2 className="mb-3 text-[1rem] font-semibold text-slate-900">Neuer Sponsor</h2>
        <form action={createSponsorEntry} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Name *</label>
            <input name="name" required placeholder="Firmenname" className="mt-1 h-9 w-full rounded-[12px] border border-slate-200 px-3 text-sm text-slate-900 outline-none focus:border-[#0b4aa2]" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Logo-URL</label>
            <input name="logoUrl" placeholder="https://..." className="mt-1 h-9 w-full rounded-[12px] border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#0b4aa2]" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Website-URL</label>
            <input name="websiteUrl" placeholder="https://..." className="mt-1 h-9 w-full rounded-[12px] border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#0b4aa2]" />
          </div>
          <div>
            <label className="text-[11px] font-semibold text-slate-500">Stufe (optional)</label>
            <input name="tier" placeholder="z.B. Hauptsponsor" className="mt-1 h-9 w-full rounded-[12px] border border-slate-200 px-3 text-sm text-slate-700 outline-none focus:border-[#0b4aa2]" />
          </div>
          <div className="sm:col-span-2 lg:col-span-4">
            <button type="submit" className="rounded-full bg-[#0b4aa2] px-4 py-2 text-[12px] font-semibold text-white hover:bg-[#08357a]">
              Sponsor hinzufügen
            </button>
          </div>
        </form>
      </section>

      {/* Sponsor list */}
      <section className="rounded-[22px] border border-slate-200/80 bg-white p-5 shadow-sm">
        {sponsors.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Award className="h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">Noch keine Sponsoren erfasst.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sponsors.map((s) => (
              <div key={s.id} className="flex items-center justify-between gap-3 rounded-[14px] border border-slate-200/80 bg-slate-50 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  {s.logoUrl && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={s.logoUrl} alt={s.name} className="h-8 w-12 object-contain" />
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-900">{s.name}</p>
                    {s.tier && <p className="text-xs text-slate-400">{s.tier}</p>}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${s.isActive ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
                    {s.isActive ? "Aktiv" : "Inaktiv"}
                  </span>
                  <form action={toggleSponsorActive}>
                    <input type="hidden" name="id" value={s.id} />
                    <input type="hidden" name="isActive" value={String(s.isActive)} />
                    <button type="submit" className="text-[11px] text-slate-400 hover:text-slate-600">
                      {s.isActive ? "Deaktivieren" : "Aktivieren"}
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
