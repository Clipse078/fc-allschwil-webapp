import fs from "node:fs";
import path from "node:path";

describe("PERSON-UX-03 Club Admin permission backfill", () => {
  const migrationPath = path.join(
    process.cwd(),
    "prisma",
    "migrations",
    "20260818211500_person_ux_03_club_admin_permission_backfill",
    "migration.sql",
  );

  const sql = fs.readFileSync(migrationPath, "utf8");

  const expectedPermissions = [
    "people.development.view",
    "people.development.manage",
    "people.assessments.view",
    "people.assessments.manage",
    "people.health.view",
    "people.health.manage",
    "people.finance.view",
    "people.finance.manage",
    "people.private_documents.view",
    "people.private_documents.manage",
    "people.audit.view",
  ];

  it("materializes RolePermission rows", () => {
    expect(sql).toContain('INSERT INTO "RolePermission"');
  });

  it("targets only tenant Club Admin roles", () => {
    expect(sql).toContain(`r."key" LIKE 'club_admin__%'`);
  });

  it("includes all PERSON-UX-03 permissions", () => {
    for (const permission of expectedPermissions) {
      expect(sql).toContain(`'${permission}'`);
    }
  });

  it("does not broaden people.view", () => {
    expect(sql).not.toContain(`'people.view'`);
  });

  it("is idempotent", () => {
    expect(sql).toContain(
      'ON CONFLICT ("roleId", "permissionId") DO NOTHING',
    );
  });
});