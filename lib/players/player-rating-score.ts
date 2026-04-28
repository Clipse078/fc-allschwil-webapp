export type PlayerRatingScoreInput = {
  overallRating?: number | null;
  potentialRating?: number | null;
  technicalRating?: number | null;
  tacticalRating?: number | null;
  physicalRating?: number | null;
  mentalityRating?: number | null;
  socialRating?: number | null;
};

function normalized(value?: number | null, fallback = 50) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.max(1, Math.min(100, Math.round(value)));
}

export function calculatePlayerRecommendationRatingScore(input?: PlayerRatingScoreInput | null) {
  if (!input) return 50;

  const overall = normalized(input.overallRating, 50);
  const potential = normalized(input.potentialRating, overall);
  const technical = normalized(input.technicalRating, overall);
  const tactical = normalized(input.tacticalRating, overall);
  const physical = normalized(input.physicalRating, overall);
  const mentality = normalized(input.mentalityRating, overall);
  const social = normalized(input.socialRating, overall);

  return Math.round(
    overall * 0.35 +
      potential * 0.2 +
      technical * 0.15 +
      tactical * 0.1 +
      physical * 0.08 +
      mentality * 0.08 +
      social * 0.04,
  );
}

export function getPlayerRatingLabel(score: number) {
  if (score >= 85) return "Top Empfehlung";
  if (score >= 70) return "Starke Empfehlung";
  if (score >= 55) return "Passende Empfehlung";
  if (score >= 40) return "Entwicklungsspieler";
  return "Prüfen";
}
