import { ExerciseDifficulty, ExerciseSport, TrainingFocus } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";

export type ClubExerciseRow = {
  id: string;
  templateId: string | null;
  sport: ExerciseSport;
  focus: TrainingFocus;
  difficulty: ExerciseDifficulty;
  title: string;
  description: string;
  setup: string | null;
  coachingPoints: string | null;
  variations: string | null;
  equipment: string | null;
  durationMinutes: number | null;
  audienceTags: string[];
  teamId: string | null;
  teamName: string | null;
};

export async function getClubExercises(args: {
  seasonId?: string | null;
  sport?: ExerciseSport | null;
}): Promise<ClubExerciseRow[]> {
  const rows = await prisma.clubExercise.findMany({
    where: {
      ...(args.seasonId ? { seasonId: args.seasonId } : {}),
      ...(args.sport ? { sport: args.sport } : {}),
    },
    orderBy: [{ sport: "asc" }, { focus: "asc" }, { createdAt: "asc" }],
    select: {
      id: true,
      templateId: true,
      sport: true,
      focus: true,
      difficulty: true,
      title: true,
      description: true,
      setup: true,
      coachingPoints: true,
      variations: true,
      equipment: true,
      durationMinutes: true,
      audienceTags: true,
      teamId: true,
      team: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    ...r,
    teamName: r.team?.name ?? null,
  }));
}

export function groupExercisesBySport(
  exercises: ClubExerciseRow[],
): Map<ExerciseSport, ClubExerciseRow[]> {
  const map = new Map<ExerciseSport, ClubExerciseRow[]>();
  for (const ex of exercises) {
    const existing = map.get(ex.sport) ?? [];
    existing.push(ex);
    map.set(ex.sport, existing);
  }
  return map;
}
