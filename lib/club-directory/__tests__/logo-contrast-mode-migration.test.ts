import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("club logo contrast migration", () => {
  const migrationPath = join(
    process.cwd(),
    "prisma/migrations/20260829160000_club_logo_contrast_mode_01a/migration.sql",
  );

  it("is additive and non-destructive", () => {
    const sql = readFileSync(migrationPath, "utf8");

    expect(sql).toContain('CREATE TYPE "LogoContrastMode" AS ENUM');
    expect(sql).toContain('ADD COLUMN "logoContrastMode"');
    expect(sql).toContain("NOT NULL DEFAULT 'NORMAL'");

    expect(sql.toLowerCase()).not.toContain("drop table");
    expect(sql.toLowerCase()).not.toContain("delete from");
    expect(sql.toLowerCase()).not.toContain("truncate");
    expect(sql.toLowerCase()).not.toContain("alter column");
  });
});
