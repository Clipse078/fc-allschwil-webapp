import type { ExerciseDifficulty, ExerciseSport, TrainingFocus } from "@prisma/client";

export const TRAINING_FOCUS_LABELS: Record<TrainingFocus, string> = {
  TECHNICAL: "Technik",
  TACTICAL: "Taktik",
  PHYSICAL: "Kondition",
  MENTAL: "Mental",
  GOALKEEPING: "Torhüter",
  OTHER: "Sonstiges",
};

export const EXERCISE_SPORT_LABELS: Record<ExerciseSport, string> = {
  FOOTBALL: "Fussball",
  BASKETBALL: "Basketball",
  HANDBALL: "Handball",
  VOLLEYBALL: "Volleyball",
  FUTSAL: "Futsal",
  TENNIS: "Tennis",
  FITNESS: "Fitness / Athletik",
};

export const EXERCISE_DIFFICULTY_LABELS: Record<ExerciseDifficulty, string> = {
  BEGINNER: "Einsteiger",
  INTERMEDIATE: "Fortgeschritten",
  ADVANCED: "Experten",
};
