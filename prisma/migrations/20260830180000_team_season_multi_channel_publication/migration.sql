-- TEAM-CHANNEL-PUBLICATION-01B — canonical multi-channel TeamSeason foundation.
--
-- Additive only: legacy visibility columns remain intact and no existing row
-- is deleted or rewritten.
--
-- WEBSITE master compatibility:
--   The public directory currently checks Team.websiteVisible, while public
--   detail checks Team.websiteVisible AND TeamSeason.websiteVisible. A
--   season-scoped canonical master cannot represent the directory's Team-only
--   rule, so the deterministic backfill uses the stricter effective detail
--   rule: Team.websiteVisible AND TeamSeason.websiteVisible. Existing Website
--   consumers remain on their legacy fields until a deliberate later cutover.
--
-- INFOBOARD compatibility:
--   Team/TeamSeason infoboardVisible currently store publication intention but
--   are not Team-level runtime gates. Their conjunction is persisted as the
--   canonical master without activating it in the existing Infoboard runtime.
--   No INFOBOARD content rows are backfilled: there is no legacy TeamSeason
--   content equivalent from which to derive non-invented semantics. The
--   centralized resolver supplies explicit safe defaults when rows are absent.

-- CreateEnum
CREATE TYPE "TeamPublicationChannel" AS ENUM ('WEBSITE', 'MOBILE_APP', 'INFOBOARD');

-- CreateEnum
CREATE TYPE "TeamPublicationContent" AS ENUM (
    'TRAINING_TIMES',
    'NEXT_MATCH',
    'NEXT_TOURNAMENT',
    'TRAINER_TEAM',
    'SQUAD',
    'TEAM_PHOTO',
    'STANDINGS'
);

-- CreateTable
CREATE TABLE "TeamSeasonPublicationChannel" (
    "id" TEXT NOT NULL,
    "teamSeasonId" TEXT NOT NULL,
    "channel" "TeamPublicationChannel" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamSeasonPublicationChannel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamSeasonPublicationContent" (
    "id" TEXT NOT NULL,
    "teamSeasonId" TEXT NOT NULL,
    "channel" "TeamPublicationChannel" NOT NULL,
    "content" "TeamPublicationContent" NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TeamSeasonPublicationContent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TeamSeasonPublicationChannel_teamSeasonId_channel_key"
    ON "TeamSeasonPublicationChannel"("teamSeasonId", "channel");

-- CreateIndex
CREATE INDEX "TeamSeasonPublicationChannel_teamSeasonId_idx"
    ON "TeamSeasonPublicationChannel"("teamSeasonId");

-- CreateIndex
CREATE INDEX "TeamSeasonPublicationChannel_channel_enabled_idx"
    ON "TeamSeasonPublicationChannel"("channel", "enabled");

-- CreateIndex
CREATE UNIQUE INDEX "TeamSeasonPublicationContent_teamSeasonId_channel_content_key"
    ON "TeamSeasonPublicationContent"("teamSeasonId", "channel", "content");

-- CreateIndex
CREATE INDEX "TeamSeasonPublicationContent_teamSeasonId_channel_idx"
    ON "TeamSeasonPublicationContent"("teamSeasonId", "channel");

-- CreateIndex
CREATE INDEX "TeamSeasonPublicationContent_channel_content_enabled_idx"
    ON "TeamSeasonPublicationContent"("channel", "content", "enabled");

-- AddForeignKey
ALTER TABLE "TeamSeasonPublicationChannel"
    ADD CONSTRAINT "TeamSeasonPublicationChannel_teamSeasonId_fkey"
    FOREIGN KEY ("teamSeasonId") REFERENCES "TeamSeason"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamSeasonPublicationContent"
    ADD CONSTRAINT "TeamSeasonPublicationContent_teamSeasonId_fkey"
    FOREIGN KEY ("teamSeasonId") REFERENCES "TeamSeason"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill channel masters. Deterministic IDs and ON CONFLICT make the data
-- portion safe to rerun independently after the tables exist.
INSERT INTO "TeamSeasonPublicationChannel"
    ("id", "teamSeasonId", "channel", "enabled", "createdAt", "updatedAt")
SELECT
    'tspc_' || md5(ts."id" || ':WEBSITE'),
    ts."id",
    'WEBSITE'::"TeamPublicationChannel",
    (t."websiteVisible" AND ts."websiteVisible"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "TeamSeason" ts
INNER JOIN "Team" t ON t."id" = ts."teamId"
ON CONFLICT ("teamSeasonId", "channel") DO NOTHING;

INSERT INTO "TeamSeasonPublicationChannel"
    ("id", "teamSeasonId", "channel", "enabled", "createdAt", "updatedAt")
SELECT
    'tspc_' || md5(ts."id" || ':INFOBOARD'),
    ts."id",
    'INFOBOARD'::"TeamPublicationChannel",
    (t."infoboardVisible" AND ts."infoboardVisible"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "TeamSeason" ts
INNER JOIN "Team" t ON t."id" = ts."teamId"
ON CONFLICT ("teamSeasonId", "channel") DO NOTHING;

INSERT INTO "TeamSeasonPublicationChannel"
    ("id", "teamSeasonId", "channel", "enabled", "createdAt", "updatedAt")
SELECT
    'tspc_' || md5(ts."id" || ':MOBILE_APP'),
    ts."id",
    'MOBILE_APP'::"TeamPublicationChannel",
    false,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "TeamSeason" ts
ON CONFLICT ("teamSeasonId", "channel") DO NOTHING;

-- Backfill Website content from exact legacy equivalents plus documented
-- compatibility defaults. This models eligibility only; no data is fabricated.
INSERT INTO "TeamSeasonPublicationContent"
    ("id", "teamSeasonId", "channel", "content", "enabled", "createdAt", "updatedAt")
SELECT
    'tspct_' || md5(ts."id" || ':WEBSITE:' || defaults.content::text),
    ts."id",
    'WEBSITE'::"TeamPublicationChannel",
    defaults.content,
    defaults.enabled,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "TeamSeason" ts
CROSS JOIN LATERAL (
    VALUES
        ('TRAINING_TIMES'::"TeamPublicationContent", true),
        ('NEXT_MATCH'::"TeamPublicationContent", ts."showNextMatch"),
        ('NEXT_TOURNAMENT'::"TeamPublicationContent", ts."showNextTournament"),
        ('TRAINER_TEAM'::"TeamPublicationContent", ts."trainerTeamWebsiteVisible"),
        ('SQUAD'::"TeamPublicationContent", ts."squadWebsiteVisible"),
        ('TEAM_PHOTO'::"TeamPublicationContent", false),
        ('STANDINGS'::"TeamPublicationContent", true)
) AS defaults(content, enabled)
ON CONFLICT ("teamSeasonId", "channel", "content") DO NOTHING;
