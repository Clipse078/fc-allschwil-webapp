import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { activateSeason } from "@/lib/seasons/mutations";
import { toSeasonApiErrorResponse } from "@/lib/seasons/errors";

type Context = {
  params: Promise<{
    seasonId: string;
  }>;
};

export async function POST(_: Request, context: Context) {
  const access = await requireApiPermission(PERMISSIONS.SEASONS_MANAGE);

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const { seasonId } = await context.params;
    const actorUserId = access.session?.user?.effectiveUserId ?? access.session?.user?.id ?? null;

    const { season, alreadyActive } = await activateSeason(seasonId, actorUserId);

    revalidatePath("/dashboard");
    revalidatePath("/dashboard/seasons");
    revalidatePath("/dashboard/seasons/planner");
    revalidatePath("/dashboard/teams");
    revalidatePath("/dashboard/training/new");

    return NextResponse.json({
      message: alreadyActive
        ? 'Saison "' + season.name + '" ist bereits aktuell.'
        : 'Saison "' + season.name + '" ist nun die aktuelle Saison.',
      season,
    });
  } catch (error) {
    const { status, body } = toSeasonApiErrorResponse(error);
    return NextResponse.json(body, { status });
  }
}
