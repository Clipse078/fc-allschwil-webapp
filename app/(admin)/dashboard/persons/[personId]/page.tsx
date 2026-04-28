import { prisma } from "@/lib/db/prisma";
import { requirePermission } from "@/lib/permissions/require-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

export default async function PersonDetailPage({
  params,
}: {
  params: { personId: string };
}) {
  await requirePermission(PERMISSIONS.PEOPLE_VIEW);

  const person = await prisma.person.findUnique({
    where: { id: params.personId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phone: true,
      isActive: true,
      isPlayer: true,
      isTrainer: true,
      trainerQualifications: {
        orderBy: { createdAt: "desc" },
        select: {
          title: true,
          status: true,
          issuer: true,
          createdAt: true,
        },
      },
    },
  });

  if (!person) {
    return <div>Person nicht gefunden</div>;
  }

  const name =
    person.displayName ??
    `${person.firstName} ${person.lastName}`.trim();

  return (
    <div className="space-y-8">
      <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[#0b4aa2]">{name}</h1>

        <div className="mt-2 flex gap-2">
          {person.isPlayer && <span className="fca-pill">Spieler</span>}
          {person.isTrainer && <span className="fca-pill">Trainer</span>}
        </div>

        <div className="mt-4 text-sm text-slate-600">
          {person.email || "—"} • {person.phone || "—"}
        </div>
      </div>

      {person.isTrainer && (
        <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="font-bold text-slate-900">
            Trainer Qualifikationen
          </h2>

          <div className="mt-4 space-y-3">
            {person.trainerQualifications.map((q, i) => (
              <div key={i} className="text-sm">
                <p className="font-semibold">{q.title}</p>
                <p className="text-slate-500">
                  {q.status} • {q.issuer ?? "Unbekannt"}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
