type Props = {
  team: any;
};

function getName(p: any) {
  return p.displayName || `${p.firstName} ${p.lastName}`;
}

export default function TeamPage({ team }: Props) {
  const season = team.activeSeason;

  return (
    <div className="space-y-12">

      {/* TRAINERTEAM */}
      {season?.trainerTeamWebsiteVisible && (
        <section>
          <h2 className="text-2xl font-bold">Trainerteam</h2>
          <div className="grid gap-4 md:grid-cols-3 mt-4">
            {season.trainerTeamMembers.map((t: any) => (
              <div key={t.id} className="p-4 border rounded-xl">
                <p className="font-semibold">{getName(t.person)}</p>
                <p className="text-sm text-slate-500">{t.roleLabel}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* TRAININGS */}
      {season?.trainingsWebsiteVisible && (
        <section>
          <h2 className="text-2xl font-bold">Trainingszeiten</h2>
        </section>
      )}

      {/* MATCHES */}
      {season?.upcomingMatchesWebsiteVisible && (
        <section>
          <h2 className="text-2xl font-bold">Nächste Spiele</h2>
        </section>
      )}

      {/* RESULTS */}
      {season?.resultsWebsiteVisible && (
        <section>
          <h2 className="text-2xl font-bold">Resultate</h2>
        </section>
      )}

      {/* STANDINGS */}
      {season?.standingsWebsiteVisible && (
        <section>
          <h2 className="text-2xl font-bold">Rangliste</h2>
        </section>
      )}

      {/* KADER */}
      {season?.squadWebsiteVisible && (
        <section>
          <h2 className="text-2xl font-bold">Kader</h2>
          <div className="mt-4 space-y-2">
            {season.playerSquadMembers.map((p: any) => (
              <div key={p.id} className="flex gap-4">
                <span className="w-10">{p.shirtNumber ?? "-"}</span>
                <span>{getName(p.person)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
