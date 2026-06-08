import Link from "next/link";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type DashboardModuleCardItem = {
  key: string;
  title: string;
  description: string;
  href: string;
  isVisible: boolean;
};

type DashboardModuleCardsProps = {
  modules: DashboardModuleCardItem[];
};

export default function DashboardModuleCards({
  modules,
}: DashboardModuleCardsProps) {
  const visibleModules = modules.filter((module) => module.isVisible);
  const hiddenModules = modules.filter((module) => !module.isVisible);

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <div>
          <p className="fca-eyebrow">Module</p>
          <h3 className="fca-heading mt-2">Verfügbare Bereiche</h3>
          <p className="fca-body-muted mt-3 max-w-2xl">
            Einstieg in die freigeschalteten FCA WebApp Bereiche mit derselben
            Premium-UX wie auf der Website.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleModules.map((module) => (
            <Link
              key={module.key}
              href={module.href}
              className="group block"
            >
              <AdminSurfaceCard className="h-full p-5 transition duration-200 group-hover:-translate-y-[2px] group-hover:shadow-[0_22px_40px_rgba(15,23,42,0.08)]">
                <div className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="fca-eyebrow">
                        Modul
                      </p>
                      <h4 className="fca-subheading mt-2">
                        {module.title}
                      </h4>
                    </div>

                    <span className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-[#0b4aa2]">
                      Live
                    </span>
                  </div>

                  <p className="fca-body-muted mt-4">
                    {module.description}
                  </p>

                  <div className="mt-6 flex items-center justify-between pt-2">
                    <span className="fca-button-primary">
                      Bereich öffnen
                    </span>

                    <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400 transition group-hover:text-red-600">
                      FCA
                    </span>
                  </div>
                </div>
              </AdminSurfaceCard>
            </Link>
          ))}
        </div>
      </section>

      {hiddenModules.length > 0 ? (
        <AdminSurfaceCard className="p-5">
          <p className="fca-eyebrow">
            Nicht freigeschaltet
          </p>

          <h3 className="fca-subheading mt-2">
            Versteckte Bereiche für diese Rolle
          </h3>

          <p className="fca-body-muted mt-3 max-w-2xl">
            Diese Module sind im System vorgesehen, aktuell für den angemeldeten
            Benutzer aber noch nicht freigegeben.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            {hiddenModules.map((module) => (
              <span key={module.key} className="fca-pill">
                {module.title}
              </span>
            ))}
          </div>
        </AdminSurfaceCard>
      ) : null}
    </div>
  );
}
