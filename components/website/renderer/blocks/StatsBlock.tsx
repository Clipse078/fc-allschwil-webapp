import type { WebsiteTheme } from "@/lib/website/theme-engine";

type StatItem = { label: string; value: string };

type Props = {
  props: { stats?: StatItem[] };
  theme: WebsiteTheme;
};

const DEFAULT_STATS: StatItem[] = [
  { label: "Mitglieder", value: "—" },
  { label: "Teams", value: "—" },
  { label: "Jahre", value: "—" },
];

export default function StatsBlock({ props, theme }: Props) {
  const stats = props.stats && Array.isArray(props.stats) && props.stats.length > 0
    ? props.stats as StatItem[]
    : DEFAULT_STATS;

  return (
    <section className="px-6 py-12 lg:px-12">
      <div
        className="mx-auto grid max-w-4xl gap-6 divide-x text-center"
        style={{
          gridTemplateColumns: `repeat(${stats.length}, minmax(0, 1fr))`,
          borderColor: theme.border,
        }}
      >
        {stats.map((s) => (
          <div key={s.label} className="px-4">
            <p className="text-4xl font-bold" style={{ color: theme.primary }}>
              {s.value}
            </p>
            <p className="mt-1 text-sm font-medium" style={{ color: theme.textMuted }}>
              {s.label}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
