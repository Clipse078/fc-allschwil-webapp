import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  ACCEPTANCE_BOOTSTRAP_TRANSACTION_OPTIONS,
  assertAcceptanceBootstrapEnvironment,
} from "@/lib/acceptance/bootstrap";

describe("bootstrap-acceptance transaction configuration", () => {
  it("uses the exported bootstrap transaction options in the canonical script", () => {
    const source = readFileSync(
      resolve(process.cwd(), "scripts/bootstrap-acceptance.ts"),
      "utf8",
    );

    expect(source).toContain("ACCEPTANCE_BOOTSTRAP_TRANSACTION_OPTIONS");
    expect(source).toContain("await prisma.$transaction(");
    expect(source).toMatch(
      /\$transaction\([\s\S]*ACCEPTANCE_BOOTSTRAP_TRANSACTION_OPTIONS,[\s\S]*\);/,
    );
  });

  it("keeps the exported transaction options scoped to Acceptance bootstrap only", () => {
    expect(ACCEPTANCE_BOOTSTRAP_TRANSACTION_OPTIONS).toEqual({
      maxWait: 10_000,
      timeout: 30_000,
    });
  });

  it("does not weaken Acceptance environment guards in the canonical script", () => {
    const source = readFileSync(
      resolve(process.cwd(), "scripts/bootstrap-acceptance.ts"),
      "utf8",
    );

    expect(source).toContain("assertAcceptanceBootstrapEnvironment(process.env)");
    expect(source).toContain("bootstrapAcceptanceData(tx, passwords)");
    expect(source).not.toContain("prisma db push");
    expect(source).not.toContain("migrate reset");
    expect(() =>
      assertAcceptanceBootstrapEnvironment({
        NODE_ENV: "production",
        APP_ENV: "stage",
        VERCEL_TARGET_ENV: "acceptance",
        DATABASE_URL:
          "postgresql://acceptance:secret@acceptance-db.example.com:5432/sce_acceptance",
        ACCEPTANCE_DATABASE_HOST: "acceptance-db.example.com",
        ACCEPTANCE_BOOTSTRAP_CONFIRM: "BOOTSTRAP_ISOLATED_ACCEPTANCE",
        SCE_OPERATION_AUTHORIZATION: "bootstrap-acceptance:acceptance",
      }),
    ).toThrow();
  });
});
