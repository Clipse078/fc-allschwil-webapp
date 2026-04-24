import BusinessClubSponsorManager from "@/components/admin/business-club/BusinessClubSponsorManager";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export default async function Page() {
  const sponsors = await prisma.businessClubSponsor.findMany({
    orderBy: [
      { active: "desc" },
      { infoboardVisible: "desc" },
      { infoboardSortOrder: "asc" },
      { tier: "asc" },
      { displayName: "asc" },
    ],
    select: {
      id: true,
      displayName: true,
      companyName: true,
      tier: true,
      active: true,
      infoboardVisible: true,
      infoboardWeight: true,
      infoboardSortOrder: true,
      remarks: true,
    },
  });

  return (
    <main className="space-y-6">
      <section className="rounded-[32px] border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">
          2. Operations & Organisation
        </p>
        <h1 className="mt-2 text-4xl font-black uppercase tracking-tight text-[#0b4aa2]">
          Business Club
        </h1>
        <p className="mt-3 max-w-3xl text-base font-medium leading-7 text-slate-600">
          Verwaltung der Sponsoren und Steuerung der Sponsor-Sichtbarkeit auf dem Infoboard.
        </p>
      </section>

      <BusinessClubSponsorManager sponsors={sponsors} />
    </main>
  );
}
