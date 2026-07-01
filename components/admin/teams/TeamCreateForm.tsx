"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Button, FormSection, ValidationSummary } from "@/components/ui";
import { FormPagePattern } from "@/components/ui/patterns";

const CATEGORY_OPTIONS = [
  { value: "KINDERFUSSBALL", label: "Kinderfussball" },
  { value: "JUNIOREN", label: "Junioren" },
  { value: "AKTIVE", label: "Aktive" },
  { value: "FRAUEN", label: "Frauen" },
  { value: "SENIOREN", label: "Senioren" },
  { value: "TRAININGSGRUPPE", label: "Trainingsgruppe" },
];

type SeasonOption = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  startDate: string;
  endDate: string;
};

type OrgUnitOption = {
  id: string;
  name: string;
  key: string;
  type: string;
};

type Props = {
  availableOrgUnits: OrgUnitOption[];
};

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function TeamCreateForm({ availableOrgUnits }: Props) {
  const router = useRouter();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [category, setCategory] = useState("KINDERFUSSBALL");
  const [seasonId, setSeasonId] = useState("");
  const [genderGroup, setGenderGroup] = useState("");
  const [ageGroup, setAgeGroup] = useState("");
  const [sortOrder, setSortOrder] = useState(0);
  const [orgUnitId, setOrgUnitId] = useState<string | null>(null);

  const [seasonOptions, setSeasonOptions] = useState<SeasonOption[]>([]);
  const [seasonsLoading, setSeasonsLoading] = useState(true);
  const [seasonsError, setSeasonsError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generatedSlug = useMemo(() => slugify(name), [name]);

  useEffect(() => {
    let isMounted = true;

    async function loadSeasons() {
      setSeasonsLoading(true);
      setSeasonsError(null);

      try {
        const response = await fetch("/api/seasons", {
          method: "GET",
          cache: "no-store",
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error ?? "Saisons konnten nicht geladen werden.");
        }

        if (!isMounted) return;

        const seasons = Array.isArray(data) ? (data as SeasonOption[]) : [];
        setSeasonOptions(seasons);

        const preferredSeason =
          seasons.find((item) => item.isActive) ??
          seasons[0] ??
          null;

        setSeasonId(preferredSeason?.id ?? "");
      } catch (err) {
        if (!isMounted) return;

        setSeasonOptions([]);
        setSeasonId("");
        setSeasonsError(
          err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
        );
      } finally {
        if (isMounted) setSeasonsLoading(false);
      }
    }

    loadSeasons();

    return () => {
      isMounted = false;
    };
  }, []);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/teams", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name,
          slug: slug || generatedSlug,
          seasonId,
          category,
          genderGroup: genderGroup || null,
          ageGroup: ageGroup || null,
          sortOrder,
          orgUnitId,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          data?.error ??
            "Team konnte nicht erstellt werden. Ursache wurde vom Server nicht geliefert."
        );
      }

      router.push("/dashboard/teams/" + data.teamId);
      router.refresh();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein unbekannter Fehler ist aufgetreten."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const errorMessages = [
    ...(seasonsError ? [seasonsError] : []),
    ...(error ? [error] : []),
  ];

  return (
    <form onSubmit={handleSubmit}>
      <FormPagePattern
        eyebrow="Teams"
        title="Neues Team"
        description="Lege ein neues Team an. Wenn eine aktive Saison vorhanden ist, wird automatisch eine Team-Season-Zuordnung erstellt."
        breadcrumbs={[
          { label: "Dashboard", href: "/dashboard" },
          { label: "Teams", href: "/dashboard/teams" },
          { label: "Neues Team" },
        ]}
        validationSummary={
          errorMessages.length > 0
            ? <ValidationSummary errors={errorMessages} />
            : undefined
        }
        cancelAction={
          <Button
            variant="secondary"
            type="button"
            onClick={() => router.push("/dashboard/teams")}
          >
            Abbrechen
          </Button>
        }
        primaryAction={
          <Button
            type="submit"
            loading={submitting}
            disabled={submitting || seasonsLoading || !seasonId}
          >
            Team erstellen
          </Button>
        }
      >
        <FormSection
          title="Saison & Kategorie"
          description="Teams werden saisonspezifisch angelegt. Existiert ein Team bereits im Club, kann derselbe Teamname nur für eine neue zukünftige Saison erneut zugeordnet werden."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="fca-label">Saison *</span>
              <select
                value={seasonId}
                onChange={(event) => setSeasonId(event.target.value)}
                className="fca-select"
                disabled={seasonsLoading || seasonOptions.length === 0}
                required
              >
                <option value="">
                  {seasonsLoading ? "Saisons laden..." : "Bitte wählen"}
                </option>
                {seasonOptions.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                    {season.isActive ? " (aktuell)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-1.5">
              <span className="fca-label">Kategorie</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="fca-select"
              >
                {CATEGORY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </FormSection>

        <FormSection
          title="Team-Details"
          description="Name, Slug und Klassifizierung des Teams."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1.5">
              <span className="fca-label">Teamname *</span>
              <input
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (!slug) {
                    setSlug(slugify(event.target.value));
                  }
                }}
                className="fca-input"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="fca-label">Slug *</span>
              <input
                type="text"
                value={slug}
                onChange={(event) => setSlug(slugify(event.target.value))}
                className="fca-input font-mono text-xs"
                required
              />
            </label>

            <label className="block space-y-1.5">
              <span className="fca-label">Geschlechtergruppe</span>
              <input
                type="text"
                value={genderGroup}
                onChange={(event) => setGenderGroup(event.target.value)}
                className="fca-input"
                placeholder="z. B. Boys, Girls, Mixed"
              />
            </label>

            <label className="block space-y-1.5">
              <span className="fca-label">Teamstufe</span>
              <input
                type="text"
                value={ageGroup}
                onChange={(event) => setAgeGroup(event.target.value)}
                className="fca-input"
                placeholder="z. B. E, D9, Aktive"
              />
            </label>

            <label className="block space-y-1.5 sm:max-w-[220px]">
              <span className="fca-label">Sortierung</span>
              <input
                type="number"
                value={sortOrder}
                onChange={(event) => setSortOrder(Number(event.target.value))}
                className="fca-input"
              />
            </label>
          </div>
        </FormSection>

        <FormSection
          title="Organisation"
          description="Optionale Verknüpfung mit einer Organisationseinheit (z. B. Abteilung)."
        >
          <label className="block space-y-1.5">
            <span className="fca-label">Organisationseinheit</span>
            <select
              value={orgUnitId ?? ""}
              onChange={(event) => setOrgUnitId(event.target.value || null)}
              className="fca-select"
            >
              <option value="">— keine Verknüpfung —</option>
              {availableOrgUnits.map((ou) => (
                <option key={ou.id} value={ou.id}>
                  {ou.name} ({ou.key})
                </option>
              ))}
            </select>
          </label>
        </FormSection>
      </FormPagePattern>
    </form>
  );
}
