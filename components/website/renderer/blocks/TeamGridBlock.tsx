import type { WebsiteTheme } from "@/lib/website/theme-engine";
import type { PublicTeamItem } from "@/lib/website/public-queries";

type Props = {
  props: { heading?: string; showCategory?: boolean };
  theme: WebsiteTheme;
  teams: PublicTeamItem[];
};

const CATEGORY_LABELS: Record<string, string> = {
  KINDERFUSSBALL: "Kinder",
  JUNIOREN: "Junioren",
  AKTIVE: "Aktive",
  FRAUEN: "Frauen",
  SENIOREN: "Senioren",
  TRAININGSGRUPPE: "Trainingsgruppe",
};

export default function TeamGridBlock({ props, theme, teams }: Props) {
  const heading = props.heading ?? "Unsere Teams";

  return (
    <section className="px-6 py-14 lg:px-12" style={{ backgroundColor: theme.accent }}>
      <div className="mx-auto max-w-5xl">
        <h2 className="text-2xl font-bold tracking-tight" style={{ color: theme.text }}>
          {heading}
        </h2>

        {teams.length === 0 ? (
          <p className="mt-6 text-sm" style={{ color: theme.textMuted }}>
            Keine Teams verfügbar.
          </p>
        ) : (
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <div
                key={team.id}
                className="rounded-[14px] p-4"
                style={{ backgroundColor: "white", border: `1px solid ${theme.border}` }}
              >
                <p className="font-semibold" style={{ color: theme.text }}>
                  {team.name}
                </p>
                {props.showCategory !== false && (
                  <p className="mt-0.5 text-[12px]" style={{ color: theme.textMuted }}>
                    {CATEGORY_LABELS[team.category] ?? team.category}
                    {team.ageGroup ? ` · ${team.ageGroup}` : ""}
                    {team.genderGroup ? ` · ${team.genderGroup}` : ""}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
