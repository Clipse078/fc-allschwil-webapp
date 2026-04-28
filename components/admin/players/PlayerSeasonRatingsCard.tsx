"use client";

import { useMemo, useState, useTransition } from "react";
import { Plus, Save, Trash2, X } from "lucide-react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import {
  calculatePlayerRecommendationRatingScore,
  getPlayerRatingLabel,
} from "@/lib/players/player-rating-score";

type SeasonOption = {
  id: string;
  key: string;
  name: string | null;
  isActive: boolean;
};

type RatingItem = {
  id: string;
  personId: string;
  seasonId: string;
  overallRating: number;
  potentialRating: number | null;
  technicalRating: number | null;
  tacticalRating: number | null;
  physicalRating: number | null;
  mentalityRating: number | null;
  socialRating: number | null;
  notes: string | null;
  season: SeasonOption;
};

type Props = {
  personId: string;
  seasons: SeasonOption[];
  currentSeasonId: string | null;
  initialRatings: RatingItem[];
  canEdit: boolean;
};

const ratingFields = [
  { key: "potentialRating", label: "Potential" },
  { key: "technicalRating", label: "Technical" },
  { key: "tacticalRating", label: "Tactical" },
  { key: "physicalRating", label: "Physical" },
  { key: "mentalityRating", label: "Mentality" },
  { key: "socialRating", label: "Social" },
] as const;

type RatingFieldKey = (typeof ratingFields)[number]["key"];

type FormState = Record<RatingFieldKey, number> & {
  seasonId: string;
  notes: string;
};

function scoreToStars(score: number | null | undefined) {
  if (typeof score !== "number" || !Number.isFinite(score)) return 0;
  return Math.round(Math.max(0, Math.min(100, score)) / 10) / 2;
}

function starsToScore(stars: number) {
  return Math.round(Math.max(0, Math.min(5, stars)) * 20);
}

function formatStars(score: number | null | undefined) {
  return scoreToStars(score).toFixed(1);
}

function calculateOverallScore(input: Partial<Record<RatingFieldKey, number | null>>) {
  const values = ratingFields
    .map((field) => input[field.key])
    .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

  if (!values.length) return 50;

  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getRatingScore(rating: Partial<Record<RatingFieldKey, number | null>> & { overallRating?: number | null }) {
  const overallRating =
    typeof rating.overallRating === "number"
      ? rating.overallRating
      : calculateOverallScore(rating);

  return calculatePlayerRecommendationRatingScore({
    overallRating,
    potentialRating: rating.potentialRating ?? null,
    technicalRating: rating.technicalRating ?? null,
    tacticalRating: rating.tacticalRating ?? null,
    physicalRating: rating.physicalRating ?? null,
    mentalityRating: rating.mentalityRating ?? null,
    socialRating: rating.socialRating ?? null,
  });
}

function getAverage(values: number[]) {
  if (!values.length) return null;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function getAverageRating(ratings: RatingItem[]) {
  const result: Partial<Record<RatingFieldKey, number | null>> & { overallRating?: number | null } = {};

  for (const field of ratingFields) {
    const values = ratings
      .map((rating) => rating[field.key])
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value));

    result[field.key] = getAverage(values);
  }

  result.overallRating = calculateOverallScore(result);

  return result;
}

function toFormState(rating: RatingItem | null, fallbackSeasonId: string): FormState {
  return {
    seasonId: rating?.seasonId ?? fallbackSeasonId,
    potentialRating: rating?.potentialRating ?? 50,
    technicalRating: rating?.technicalRating ?? 50,
    tacticalRating: rating?.tacticalRating ?? 50,
    physicalRating: rating?.physicalRating ?? 50,
    mentalityRating: rating?.mentalityRating ?? 50,
    socialRating: rating?.socialRating ?? 50,
    notes: rating?.notes ?? "",
  };
}

export default function PlayerSeasonRatingsCard({
  personId,
  seasons,
  currentSeasonId,
  initialRatings,
  canEdit,
}: Props) {
  const fallbackSeasonId = currentSeasonId ?? seasons[0]?.id ?? "";
  const [ratings, setRatings] = useState<RatingItem[]>(initialRatings);
  const currentRating = ratings.find((rating) => rating.seasonId === currentSeasonId) ?? null;
  const [form, setForm] = useState<FormState>(() => toFormState(currentRating, fallbackSeasonId));
  const [editingSeasonId, setEditingSeasonId] = useState<string | null>(currentRating?.seasonId ?? fallbackSeasonId);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const priorRatings = useMemo(
    () => ratings.filter((rating) => rating.seasonId !== currentSeasonId),
    [ratings, currentSeasonId],
  );

  const averageAllRatings = useMemo(() => getAverageRating(ratings), [ratings]);
  const averagePriorRatings = useMemo(() => getAverageRating(priorRatings), [priorRatings]);
  const formOverallScore = calculateOverallScore(form);

  const currentScore = currentRating ? getRatingScore(currentRating) : null;
  const combinedScore = ratings.length ? getRatingScore(averageAllRatings) : null;
  const priorScore = priorRatings.length ? getRatingScore(averagePriorRatings) : null;

  function updateField(key: keyof FormState, value: string | number) {
    setForm((current) => ({
      ...current,
      [key]: typeof value === "number" ? Math.max(0, Math.min(100, value)) : value,
    }));
  }

  function editRating(rating: RatingItem) {
    setEditingSeasonId(rating.seasonId);
    setForm(toFormState(rating, fallbackSeasonId));
  }

  function resetToNew() {
    setEditingSeasonId(null);
    setForm(toFormState(null, fallbackSeasonId));
  }

  function saveRating() {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/people/${personId}/season-ratings`, {
          method: editingSeasonId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error ?? "Bewertung konnte nicht gespeichert werden.");
        }

        const savedRating = data.rating as RatingItem;

        setRatings((current) => {
          const withoutSameSeason = current.filter((rating) => rating.seasonId !== savedRating.seasonId);
          return [savedRating, ...withoutSameSeason].sort((a, b) => (b.season?.key ?? "").localeCompare(a.season?.key ?? ""));
        });

        setEditingSeasonId(savedRating.seasonId);
        setForm(toFormState(savedRating, fallbackSeasonId));
      } catch (saveError) {
        setError(saveError instanceof Error ? saveError.message : "Bewertung konnte nicht gespeichert werden.");
      }
    });
  }

  function deleteRating(seasonId: string) {
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/people/${personId}/season-ratings`, {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ seasonId }),
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          throw new Error(data?.error ?? "Bewertung konnte nicht gelöscht werden.");
        }

        setRatings((current) => current.filter((rating) => rating.seasonId !== seasonId));
        resetToNew();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Bewertung konnte nicht gelöscht werden.");
      }
    });
  }

  return (
    <AdminSurfaceCard className="overflow-hidden p-0">
      <div className="h-1.5 w-full bg-gradient-to-r from-[#0b4aa2] via-[#6a5acd] to-[#d62839]" />

      <div className="space-y-6 p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-red-600">
              Player Rating
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
              Season Ratings
            </h2>
          </div>

          <button
            type="button"
            onClick={resetToNew}
            className="inline-flex items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
          >
            <Plus className="h-4 w-4" />
            Neue Bewertung
          </button>
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          <RatingSummaryCard label="Aktuelle Saison" score={currentScore} emptyText="Noch keine Bewertung" />
          <RatingSummaryCard label="Ø Vorherige Saisons" score={priorScore} emptyText="Noch keine Historie" />
          <RatingSummaryCard label="Ø Gesamt inkl. aktuell" score={combinedScore} emptyText="Noch keine Bewertung" highlight />
        </div>

        <div className="grid gap-6 xl:grid-cols-[1fr_0.9fr]">
          <div className="space-y-3">
            {ratings.length === 0 ? (
              <div className="rounded-[28px] border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-500">
                Noch keine Spielerbewertungen vorhanden.
              </div>
            ) : (
              ratings.map((rating) => {
                const score = getRatingScore(rating);
                const autoOverall = calculateOverallScore(rating);

                return (
                  <article key={rating.id} className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_16px_35px_rgba(15,23,42,0.05)]">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-semibold text-slate-950">{rating.season.name ?? rating.season.key}</p>
                          {rating.seasonId === currentSeasonId ? (
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                              Aktuell
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm text-slate-500">
                          {getPlayerRatingLabel(score)} · Overall {formatStars(autoOverall)} ★ · Score {score}
                        </p>
                      </div>

                      <div className="flex gap-2">
                        <button type="button" onClick={() => editRating(rating)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50">
                          Bearbeiten
                        </button>
                        <button type="button" onClick={() => deleteRating(rating.seasonId)} disabled={isPending || !canEdit} className="rounded-full border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-600 transition hover:bg-red-50 disabled:opacity-50">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">Overall automatisch</span>
                        <span className="text-sm font-semibold text-slate-700">{formatStars(autoOverall)}</span>
                      </div>
                      <StaticStars score={autoOverall} />
                    </div>

                    <div className="mt-4 grid gap-2">
                      {ratingFields.map((field) => (
                        <div key={field.key} className="flex items-center justify-between gap-4 rounded-xl bg-white px-3 py-2">
                          <p className="min-w-24 text-sm font-semibold text-slate-700">{field.label}</p>
                          <StaticStars score={rating[field.key]} />
                          <p className="w-10 text-right text-sm font-semibold text-slate-600">{formatStars(rating[field.key])}</p>
                        </div>
                      ))}
                    </div>

                    {rating.notes ? (
                      <p className="mt-4 rounded-2xl bg-blue-50/70 px-4 py-3 text-sm leading-6 text-slate-600">{rating.notes}</p>
                    ) : null}
                  </article>
                );
              })
            )}
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_18px_45px_rgba(15,23,42,0.06)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
                  {editingSeasonId ? "Bewertung bearbeiten" : "Neue Bewertung"}
                </p>
                <p className="mt-1 font-semibold text-slate-950">
                  {getPlayerRatingLabel(getRatingScore({ ...form, overallRating: formOverallScore }))}
                </p>
              </div>
              <div className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700">Scouting</div>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">Saison</span>
                <select
                  value={form.seasonId}
                  onChange={(event) => updateField("seasonId", event.target.value)}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 outline-none transition focus:border-blue-300"
                >
                  {seasons.map((season) => (
                    <option key={season.id} value={season.id}>{season.name ?? season.key}</option>
                  ))}
                </select>
              </label>

              <div className="rounded-[26px] border border-blue-100 bg-gradient-to-br from-blue-50 via-white to-amber-50 px-5 py-5 text-center shadow-inner">
                <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-blue-500">Overall Rating</p>
                <p className="mt-2 text-5xl font-semibold tracking-tight text-slate-950">{formatStars(formOverallScore)}</p>
                <div className="mt-3 flex justify-center"><StaticStars score={formOverallScore} size="lg" /></div>
                <p className="mt-3 text-sm font-semibold text-slate-700">{getPlayerRatingLabel(getRatingScore({ ...form, overallRating: formOverallScore }))}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">Automatisch aus den Detailbewertungen berechnet.</p>
              </div>

              {ratingFields.map((field) => (
                <StarRatingInput key={field.key} label={field.label} score={form[field.key]} onChange={(score) => updateField(field.key, score)} />
              ))}

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Notizen</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateField("notes", event.target.value)}
                  rows={3}
                  className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 outline-none transition focus:border-blue-300"
                  placeholder="Kurze Einschätzung..."
                />
              </label>

              {error ? (
                <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">{error}</p>
              ) : null}

              <div className="flex justify-end gap-2">
                <button type="button" onClick={resetToNew} className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50">
                  <X className="h-4 w-4" />
                  Abbrechen
                </button>
                <button type="button" onClick={saveRating} disabled={isPending || !canEdit || !form.seasonId} className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d62839] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(214,40,57,0.25)] transition hover:bg-[#b91f2f] disabled:cursor-not-allowed disabled:opacity-50">
                  <Save className="h-4 w-4" />
                  {isPending ? "Speichern..." : "Speichern"}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </AdminSurfaceCard>
  );
}

function RatingSummaryCard({
  label,
  score,
  emptyText,
  highlight,
}: {
  label: string;
  score: number | null;
  emptyText: string;
  highlight?: boolean;
}) {
  return (
    <div className={"rounded-[24px] border p-4 " + (highlight ? "border-blue-200 bg-blue-50/80" : "border-slate-200 bg-white")}>
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      {score === null ? (
        <p className="mt-3 text-sm font-medium text-slate-500">{emptyText}</p>
      ) : (
        <>
          <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950">{formatStars(score)} ★</p>
          <p className="mt-1 text-sm font-semibold text-slate-600">{getPlayerRatingLabel(score)}</p>
        </>
      )}
    </div>
  );
}

function StaticStars({
  score,
  size = "md",
}: {
  score: number | null | undefined;
  size?: "sm" | "md" | "lg";
}) {
  const stars = scoreToStars(score);
  const className = size === "lg" ? "h-8 w-8 drop-shadow-[0_1px_1px_rgba(0,0,0,0.08)]" : size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="flex items-center gap-1.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <StarIcon key={i} value={stars} index={i} className={className} />
      ))}
    </div>
  );
}

function StarIcon({
  value,
  index,
  className,
}: {
  value: number;
  index: number;
  className: string;
}) {
  const fillLevel = Math.max(0, Math.min(1, value - (index - 1)));
  const maskId = `star-mask-${index}-${String(value).replace(".", "-")}`;

  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <mask id={maskId}>
          <rect x="0" y="0" width="24" height="24" fill="black" />
          <rect x="0" y="0" width={24 * fillLevel} height="24" fill="white" />
        </mask>
      </defs>
      <path d="M12 2.4l2.92 5.92 6.54.95-4.73 4.61 1.12 6.51L12 17.31l-5.85 3.08 1.12-6.51-4.73-4.61 6.54-.95L12 2.4z" fill="#e2e8f0" />
      <path d="M12 2.4l2.92 5.92 6.54.95-4.73 4.61 1.12 6.51L12 17.31l-5.85 3.08 1.12-6.51-4.73-4.61 6.54-.95L12 2.4z" fill="#facc15" mask={`url(#${maskId})`} />
    </svg>
  );
}

function StarRatingInput({
  label,
  score,
  onChange,
}: {
  label: string;
  score: number;
  onChange: (score: number) => void;
}) {
  const stars = scoreToStars(score);
  const [hoverStars, setHoverStars] = useState<number | null>(null);
  const displayStars = hoverStars ?? stars;

  return (
    <div className="rounded-xl bg-white px-3 py-2 shadow-[0_8px_20px_rgba(15,23,42,0.03)] transition hover:shadow-[0_12px_26px_rgba(15,23,42,0.06)]">
      <div className="flex items-center justify-between gap-4">
        <span className="min-w-24 text-sm font-semibold text-slate-700">{label}</span>
        <div className="flex items-center gap-2" onMouseLeave={() => setHoverStars(null)}>
          {[1, 2, 3, 4, 5].map((index) => (
            <span key={index} className="relative inline-flex h-7 w-7">
              <button type="button" onMouseEnter={() => setHoverStars(index - 0.5)} onClick={() => onChange(starsToScore(index - 0.5))} className="absolute left-0 top-0 z-10 h-7 w-3.5 rounded-l-full" aria-label={`${label} ${index - 0.5} Sterne`} title={`${index - 0.5} Sterne`} />
              <button type="button" onMouseEnter={() => setHoverStars(index)} onClick={() => onChange(starsToScore(index))} className="absolute right-0 top-0 z-10 h-7 w-3.5 rounded-r-full" aria-label={`${label} ${index} Sterne`} title={`${index} Sterne`} />
              <StarIcon value={displayStars} index={index} className="h-7 w-7 transition hover:scale-110" />
            </span>
          ))}
        </div>
        <span className="w-10 rounded-full bg-slate-50 px-2 py-1 text-right text-xs font-semibold text-slate-600">{displayStars.toFixed(1)}</span>
      </div>
    </div>
  );
}




