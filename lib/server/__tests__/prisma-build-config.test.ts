import { describe, expect, it } from "vitest";
import {
  isPrismaGenerateCommand,
  resolvePrismaDatasourceUrlForCommand,
} from "../prisma-datasource";

describe("Prisma credential-poor build configuration", () => {
  it("uses a reserved non-routable placeholder for generate only", () => {
    const url = resolvePrismaDatasourceUrlForCommand(
      {},
      ["node", "prisma", "generate"],
    );

    expect(new URL(url!)).toHaveProperty("hostname", "prisma-generate.invalid");
  });

  it("does not mistake other Prisma commands for generate", () => {
    expect(isPrismaGenerateCommand(["node", "prisma", "migrate", "deploy"])).toBe(
      false,
    );
  });

  it("does not provide a fallback for database-capable commands", () => {
    expect(
      resolvePrismaDatasourceUrlForCommand(
        {},
        ["node", "prisma", "migrate", "deploy"],
      ),
    ).toBeNull();
  });
});
