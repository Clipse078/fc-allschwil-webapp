import Link from "next/link";

type Props = {
  teamId: string;
};

const OPERATIONAL_LINKS = [
  { key: "anwesenheit", label: "Anwesenheit", href: "/anwesenheit" },
  { key: "teilnahmen", label: "Teilnahmen", href: "/teilnahmen" },
] as const;

export default function TeamOverviewOperationalLinks({ teamId }: Props) {
  const basePath = `/dashboard/teams/${teamId}`;

  return (
    <nav
      aria-label="Weitere operative Bereiche"
      className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm"
      data-testid="team-overview-operational-links"
    >
      <span className="text-[var(--muted)]">Weitere Bereiche:</span>
      {OPERATIONAL_LINKS.map((link) => (
        <Link
          key={link.key}
          href={`${basePath}${link.href}`}
          className="font-medium text-[var(--blue)] hover:underline"
          data-testid={`team-overview-link-${link.key}`}
        >
          {link.label}
        </Link>
      ))}
    </nav>
  );
}
