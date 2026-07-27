/**
 * lib/provider-mapping/suggestion-engine.ts
 *
 * Provider team mapping suggestion engine.
 *
 * Scores all available provider teams against a given TeamSeason to produce
 * ranked suggestions with confidence levels and explanatory reasons.
 *
 * Priority signals (in order of weight):
 *   1. Competition context   — provider team participates in the same competition/league
 *   2. Team name similarity  — normalised string similarity
 *   3. Age category          — matching age category labels
 *   4. Gender                — matching gender
 *   5. Historical mapping    — team has been mapped to this provider in past seasons
 *
 * Confidence thresholds:
 *   HIGH:   score >= 75
 *   MEDIUM: score >= 45
 *   LOW:    score <  45
 *
 * Architecture invariants:
 *   - Pure function — no DB access, no side effects.
 *   - No provider-specific logic — works with normalised ProviderTeam DTOs.
 *   - Never auto-maps — only produces suggestions for human review.
 *   - Results are sorted by descending score.
 */

import type { ProviderTeam, MappingSuggestion, ConfidenceLevel } from "./types";

// ── Score weights ─────────────────────────────────────────────────────────────

const WEIGHT_COMPETITION = 40;   // Provider team is in the same competition/league
const WEIGHT_NAME        = 25;   // Normalised team name similarity
const WEIGHT_AGE         = 15;   // Age category match
const WEIGHT_GENDER      = 10;   // Gender match
const WEIGHT_HISTORY     = 10;   // Historical mapping for same team (other seasons)

// ── Confidence thresholds ─────────────────────────────────────────────────────

const THRESHOLD_HIGH   = 75;
const THRESHOLD_MEDIUM = 45;

// ── Context ────────────────────────────────────────────────────────────────────

export type SuggestionContext = {
  /** Canonical TeamSeason display name. */
  teamSeasonDisplayName: string;
  /** Team name (permanent identity). */
  teamName: string;
  /** Competition league ID relevant for this mapping (from the selected competition). */
  competitionLeagueId?: number | null;
  /** Competition league name relevant for this mapping. */
  competitionLeagueName?: string | null;
  /** Age category from the team / team season. */
  ageCategory?: string | null;
  /** Gender from the team / team season. */
  gender?: string | null;
  /** Set of externalTeamIds that were mapped to this team in prior seasons. */
  historicalExternalTeamIds?: Set<number>;
};

// ── Public API ─────────────────────────────────────────────────────────────────

/**
 * Scores and ranks provider teams as mapping suggestions for a TeamSeason.
 *
 * @param providerTeams   All provider teams to consider (unmapped + mapped).
 * @param context         TeamSeason + competition context for scoring.
 * @returns               Ranked suggestions (highest score first), capped at 20.
 */
export function suggestMappings(
  providerTeams: ProviderTeam[],
  context: SuggestionContext,
): MappingSuggestion[] {
  const suggestions = providerTeams.map((pt) => scoreProviderTeam(pt, context));

  return suggestions
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 20);
}

// ── Scoring ────────────────────────────────────────────────────────────────────

function scoreProviderTeam(
  providerTeam: ProviderTeam,
  context: SuggestionContext,
): MappingSuggestion {
  let score = 0;
  const reasons: string[] = [];

  // 1. Competition context signal
  if (
    context.competitionLeagueId != null &&
    providerTeam.leagueId != null &&
    providerTeam.leagueId === context.competitionLeagueId
  ) {
    score += WEIGHT_COMPETITION;
    reasons.push(`Gleiche Liga: ${providerTeam.leagueName ?? context.competitionLeagueName ?? String(context.competitionLeagueId)}`);
  } else if (
    context.competitionLeagueName &&
    providerTeam.leagueName &&
    normalise(providerTeam.leagueName) === normalise(context.competitionLeagueName)
  ) {
    score += WEIGHT_COMPETITION * 0.9;
    reasons.push(`Ähnlicher Liganame: ${providerTeam.leagueName}`);
  }

  // 2. Team name similarity signal
  const nameSim = nameSimilarity(providerTeam.name, context.teamName);
  if (nameSim > 0) {
    const nameScore = Math.round(nameSim * WEIGHT_NAME);
    score += nameScore;
    if (nameSim >= 0.8) {
      reasons.push(`Hohe Namensähnlichkeit: "${providerTeam.name}"`);
    } else if (nameSim >= 0.5) {
      reasons.push(`Mässige Namensähnlichkeit: "${providerTeam.name}"`);
    }
  }

  // 3. Age category signal
  if (
    context.ageCategory &&
    providerTeam.ageCategory &&
    normalise(context.ageCategory) === normalise(providerTeam.ageCategory)
  ) {
    score += WEIGHT_AGE;
    reasons.push(`Altersklasse stimmt überein: ${providerTeam.ageCategory}`);
  } else if (
    context.ageCategory &&
    providerTeam.ageCategory &&
    ageCategoryPartialMatch(context.ageCategory, providerTeam.ageCategory)
  ) {
    score += Math.round(WEIGHT_AGE * 0.5);
    reasons.push(`Ähnliche Altersklasse: ${providerTeam.ageCategory}`);
  } else if (
    context.ageCategory &&
    providerTeam.name &&
    normalise(providerTeam.name).includes(normalise(context.ageCategory))
  ) {
    score += Math.round(WEIGHT_AGE * 0.3);
    reasons.push(`Altersklasse im Teamnamen: ${context.ageCategory}`);
  }

  // 4. Gender signal
  if (
    context.gender &&
    providerTeam.gender &&
    normaliseGender(context.gender) === normaliseGender(providerTeam.gender)
  ) {
    score += WEIGHT_GENDER;
    reasons.push(`Geschlecht stimmt überein: ${providerTeam.gender}`);
  }

  // 5. Historical mapping signal
  if (
    context.historicalExternalTeamIds?.has(providerTeam.externalTeamId)
  ) {
    score += WEIGHT_HISTORY;
    reasons.push("Wurde in vergangener Saison diesem Team zugeordnet");
  }

  const confidenceLevel = computeConfidence(score);

  return { providerTeam, score, confidenceLevel, reasons };
}

function computeConfidence(score: number): ConfidenceLevel {
  if (score >= THRESHOLD_HIGH) return "HIGH";
  if (score >= THRESHOLD_MEDIUM) return "MEDIUM";
  return "LOW";
}

// ── String normalisation ────────────────────────────────────────────────────────

/** Lower-case, collapse whitespace, remove common suffixes and punctuation. */
function normalise(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^\w\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Normalised name similarity using bigram coefficient (Dice coefficient).
 * Returns 0–1.
 */
function nameSimilarity(a: string, b: string): number {
  const na = normalise(a);
  const nb = normalise(b);
  if (na === nb) return 1;
  if (na.length < 2 || nb.length < 2) return 0;

  const bigramsA = buildBigrams(na);
  const bigramsB = buildBigrams(nb);

  let intersect = 0;
  for (const bg of bigramsA.keys()) {
    if (bigramsB.has(bg)) {
      intersect++;
      bigramsB.delete(bg);
    }
  }

  return (2 * intersect) / (bigramsA.size + countOriginalBigrams(normalise(b)));
}

function buildBigrams(s: string): Map<string, number> {
  const map = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const bg = s[i] + s[i + 1];
    map.set(bg, (map.get(bg) ?? 0) + 1);
  }
  return map;
}

function countOriginalBigrams(s: string): number {
  return Math.max(s.length - 1, 0);
}

/** Partial age category match (e.g. "U15" matches "U-15" or "Junioren U15"). */
function ageCategoryPartialMatch(a: string, b: string): boolean {
  const na = normalise(a).replace(/[^a-z0-9]/g, "");
  const nb = normalise(b).replace(/[^a-z0-9]/g, "");
  return nb.includes(na) || na.includes(nb);
}

/** Gender normalisation: "MALE" / "MÄNNLICH" / "M" → "male", etc. */
function normaliseGender(g: string): string {
  const n = g.toLowerCase().trim();
  if (["male", "männlich", "m", "herren", "knaben", "buben"].includes(n)) return "male";
  if (["female", "weiblich", "w", "f", "damen", "frauen", "mädchen"].includes(n)) return "female";
  if (["mixed", "gemischt", "x"].includes(n)) return "mixed";
  return n;
}
