import { auth } from "@/auth";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import StageEnvironmentBanner from "@/components/admin/deployment/StageEnvironmentBanner";
import AdminHeaderMetaRow from "@/components/admin/layout/AdminHeaderMetaRow";
import AdminPageActions from "@/components/admin/layout/AdminPageActions";
import AdminPageHeader from "@/components/admin/layout/AdminPageHeader";
import AdminSidebar from "@/components/admin/layout/AdminSidebar";
import StopImpersonationButton from "@/components/admin/layout/StopImpersonationButton";
import FcaBrandCrest from "@/components/shared/FcaBrandCrest";
import {
  getCurrentSeasonOptionData,
  getNextSeasonOptionData,
} from "@/lib/seasons/queries";

type AdminLayoutProps = {
  children: ReactNode;
};

function humanizeRoleKey(roleKey: string) {
  return roleKey
    .toLowerCase()
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function getHighestRoleLabel(roleKeys: string[]) {
  const priorityMap: Record<string, { rank: number; label: string }> = {
    SUPERADMIN: { rank: 100, label: "Superadmin" },
    ADMIN: { rank: 90, label: "Admin" },
    VEREINSLEITUNG: { rank: 80, label: "Vereinsleitung" },
    VEREINSLEITUNG_LEITER: { rank: 79, label: "Leiter Vereinsleitung" },
    FINANZLEITER: { rank: 78, label: "Finanzleiter" },
    TECHNISCHE_KOMMISSION: { rank: 77, label: "Technische Kommission" },
    LEITER_TECHNISCHE_KOMMISSION: { rank: 76, label: "Leiter Technische Kommission" },
    MATCHDAY_COORDINATOR: { rank: 75, label: "Matchday Coordinator" },
    REDAKTOR: { rank: 74, label: "Redaktor" },
    MEDIATEAM: { rank: 73, label: "Mediateam" },
    KIFU_COORDINATOR: { rank: 72, label: "KiFu Koordinator" },
    KOORDINATOR: { rank: 71, label: "Koordinator" },
    TRAINER: { rank: 60, label: "Trainer" },
    ASSISTANT_TRAINER: { rank: 59, label: "Assistenztrainer" },
    PLAYER: { rank: 30, label: "Spieler" },
  };

  const rankedRoles = roleKeys.map((roleKey) => ({
    roleKey,
    rank: priorityMap[roleKey]?.rank ?? 0,
    label: priorityMap[roleKey]?.label ?? humanizeRoleKey(roleKey),
  }));

  const bestMatch = rankedRoles.sort((a, b) => b.rank - a.rank)[0];
  return bestMatch?.label ?? "Benutzer";
}

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const currentSeason = await getCurrentSeasonOptionData();
  const nextSeason = await getNextSeasonOptionData();

  const currentSeasonLabel = currentSeason?.name ?? currentSeason?.key ?? "2025/2026";
  const nextSeasonLabel = nextSeason?.name ?? nextSeason?.key ?? "2026/2027";
  const highestRoleLabel = getHighestRoleLabel(session.user.roleKeys ?? []);
  const canManageSeasons = (session.user.roleKeys ?? []).some(
    (roleKey) => roleKey === "ADMIN" || roleKey === "SUPERADMIN",
  );

  return (
    <div className="fca-admin-shell text-slate-900">
      <div className="fca-admin-glow fca-admin-glow-blue left-[-120px] top-[140px] h-[320px] w-[320px]" />
      <div className="fca-admin-glow fca-admin-glow-red bottom-[40px] right-[-120px] h-[320px] w-[320px]" />

      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute left-1/2 top-[140px] h-[900px] w-[900px] -translate-x-1/2 opacity-[0.07]">
          <FcaBrandCrest className="h-full w-full" variant="watermark" />
        </div>
      </div>

      <div className="relative z-10 mx-auto flex min-h-screen max-w-[1800px]">
        <AdminSidebar
          firstName={session.user.firstName}
          lastName={session.user.lastName}
          email={session.user.email}
          permissionKeys={session.user.permissionKeys}
          currentSeasonLabel={currentSeasonLabel}
          nextSeasonLabel={nextSeasonLabel}
        />

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <StageEnvironmentBanner />

          {session.user.isImpersonating ? (
            <div className="border-b border-amber-200 bg-amber-50/95 backdrop-blur-sm">
              <div className="px-6 py-4 lg:px-8 2xl:px-10">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                      Impersonation aktiv
                    </p>
                    <p className="mt-1 text-sm text-amber-900">
                      Du bist aktuell als anderer Benutzer eingeloggt.
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                      Admin: {session.user.actorName ?? session.user.actorEmail ?? "Unbekannt"}
                    </p>
                  </div>

                  <StopImpersonationButton />
                </div>
              </div>
            </div>
          ) : null}

          <header className="border-b border-slate-200 bg-white/78 backdrop-blur-xl">
            <div className="px-6 py-6 lg:px-8 2xl:px-10">
              <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
                <div className="min-w-0 flex-1">
                  <AdminPageHeader
                    firstName={session.user.firstName}
                    currentSeasonLabel={currentSeasonLabel}
                    canManageSeasons={canManageSeasons}
                  />
                </div>

                {/* PROTECTED HEADER META ROW
                    Do not duplicate or redesign per page.
                    This row is the global premium header standard across the webapp:
                    Saison | User panel | Date & Time
                */}
                <div className="flex shrink-0 flex-col items-start gap-5 xl:items-end">
                  <AdminHeaderMetaRow
                    currentSeasonLabel={currentSeasonLabel}
                    firstName={session.user.firstName}
                    lastName={session.user.lastName}
                    roleLabel={highestRoleLabel}
                  />
                </div>
              </div>
            </div>
          </header>

          <div className="border-b border-slate-200 bg-white/60 backdrop-blur-xl">
            <div className="px-6 py-4 lg:px-8 2xl:px-10">
              <AdminPageActions />
            </div>
          </div>

          <main className="relative flex-1 px-6 py-6 lg:px-8 lg:py-7 2xl:px-10">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}