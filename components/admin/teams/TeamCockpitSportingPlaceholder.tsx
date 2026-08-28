import { SectionCard } from "@/components/ui/page";

type Props = {
  title: string;
  description: string;
};

/**
 * TEAM-COCKPIT-PREMIUM-01D: restrained structural placeholder for sporting
 * routes not yet implemented (Spiele, Resultate, Rangliste).
 */
export default function TeamCockpitSportingPlaceholder({
  title,
  description,
}: Props) {
  return (
    <SectionCard title={title}>
      <p className="text-sm text-[var(--muted)]">{description}</p>
    </SectionCard>
  );
}
