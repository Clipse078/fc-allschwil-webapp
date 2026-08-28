import Link from "next/link";
import { UserRound, Users } from "lucide-react";
import { SectionCard } from "@/components/ui/page";

type Props = {
  teamId: string;
  playerCount: number;
  trainerCount: number;
};

type CountItemProps = {
  label: string;
  value: number;
  href: string;
  icon: React.ReactNode;
};

function CountItem({ label, value, href, icon }: CountItemProps) {
  return (
    <Link
      href={href}
      className="flex min-w-0 items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)]/40 px-3 py-2.5 transition-colors hover:bg-[var(--surface-2)]"
      aria-label={`${label}: ${value} — Details öffnen`}
    >
      <div className="text-[var(--muted)]">{icon}</div>
      <div className="min-w-0">
        <p className="text-xs font-medium text-[var(--muted)]">{label}</p>
        <p
          className="text-lg font-semibold text-[var(--foreground)]"
          data-testid={`team-${label.toLowerCase()}-count`}
        >
          {value}
        </p>
      </div>
    </Link>
  );
}

export default function TeamCompositionSummary({
  teamId,
  playerCount,
  trainerCount,
}: Props) {
  const basePath = `/dashboard/teams/${teamId}`;

  return (
    <SectionCard title="Team" description="Zusammensetzung der aktuellen Saison.">
      <div
        className="grid gap-3 sm:grid-cols-2"
        data-testid="team-composition-summary"
      >
        <CountItem
          label="Spieler"
          value={playerCount}
          href={`${basePath}/kader`}
          icon={<Users className="h-4 w-4" />}
        />
        <CountItem
          label="Trainer"
          value={trainerCount}
          href={`${basePath}/trainerteam`}
          icon={<UserRound className="h-4 w-4" />}
        />
      </div>
    </SectionCard>
  );
}
