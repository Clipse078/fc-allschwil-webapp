-- PERSON-UX-07: Standard capacity flags + custom functions
--
-- Additive only. No destructive SQL. No DROP. No RENAME.
-- New columns default to false / empty array — zero data migration required.
-- DO NOT DEPLOY without infrastructure review (see MIGRATION_SAFETY in PERSON-UX-07 spec).

-- Standard capacity flags
ALTER TABLE "Person" ADD COLUMN "isFunctionary"   BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Person" ADD COLUMN "isVolunteer"      BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Person" ADD COLUMN "isReferee"        BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Person" ADD COLUMN "isSponsorContact" BOOLEAN NOT NULL DEFAULT false;

-- Club-specific custom function labels (array of text, defaulting to empty array)
ALTER TABLE "Person" ADD COLUMN "customFunctions"  TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- Indexes for capacity-based directory filtering
CREATE INDEX IF NOT EXISTS "Person_isFunctionary_idx"   ON "Person"("isFunctionary");
CREATE INDEX IF NOT EXISTS "Person_isVolunteer_idx"     ON "Person"("isVolunteer");
CREATE INDEX IF NOT EXISTS "Person_isReferee_idx"       ON "Person"("isReferee");
CREATE INDEX IF NOT EXISTS "Person_isSponsorContact_idx" ON "Person"("isSponsorContact");
