import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { logAction } from "@/lib/audit/log-action";
import { requireApiPermission } from "@/lib/permissions/require-api-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";

function getActorUserId(
  access:
    | {
        session?: {
          user?: {
            id?: string | null;
            effectiveUserId?: string | null;
          } | null;
        } | null;
      }
    | null
    | undefined,
) {
  return access?.session?.user?.effectiveUserId ?? access?.session?.user?.id ?? null;
}

function slugifyInitiativeTitle(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

async function buildUniqueInitiativeSlug(title: string) {
  const baseSlug = slugifyInitiativeTitle(title) || "initiative";

  const existing = await prisma.vereinsleitungInitiative.findMany({
    where: {
      slug: {
        startsWith: baseSlug,
      },
    },
    select: {
      slug: true,
    },
  });

  if (existing.length === 0) {
    return baseSlug;
  }

  const taken = new Set(existing.map((item) => item.slug));

  if (!taken.has(baseSlug)) {
    return baseSlug;
  }

  let counter = 2;

  while (taken.has(baseSlug + "-" + counter)) {
    counter += 1;
  }

  return baseSlug + "-" + counter;
}

export async function POST() {
  const access = await requireApiPermission(
    PERMISSIONS.VEREINSLEITUNG_INITIATIVES_MANAGE,
  );

  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  try {
    const now = new Date();
    const dateLabel = new Intl.DateTimeFormat("de-CH", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(now);

    const title = "Neue Initiative " + dateLabel;
    const slug = await buildUniqueInitiativeSlug(title);

    const initiative = await prisma.vereinsleitungInitiative.create({
      data: {
        title,
        slug,
        subtitle: "Neue Initiative",
        description: null,
        status: "IN_PROGRESS",
        startDate: now,
      },
    });

    await logAction({
      actorUserId: getActorUserId(access),
      moduleKey: "vereinsleitung",
      entityType: "VereinsleitungInitiative",
      entityId: initiative.id,
      action: "CREATE",
      afterJson: initiative,
    });

    return NextResponse.redirect(new URL("/vereinsleitung/initiativen/" + initiative.slug, process.env.NEXTAUTH_URL ?? "http://localhost:3000"), 303);
  } catch (error) {
    console.error("Create initiative failed:", error);

    if (error instanceof Error) {
      return NextResponse.json(
        { error: "Technischer Fehler: " + error.message },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Initiative konnte nicht erstellt werden." },
      { status: 500 },
    );
  }
}

