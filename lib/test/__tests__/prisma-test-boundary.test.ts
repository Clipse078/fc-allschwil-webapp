import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  pool: vi.fn(),
  adapter: vi.fn(),
  prismaClient: vi.fn(),
}));

vi.mock("pg", () => ({ Pool: mocks.pool }));
vi.mock("@prisma/adapter-pg", () => ({ PrismaPg: mocks.adapter }));
vi.mock("@prisma/client", () => ({ PrismaClient: mocks.prismaClient }));

const ORIGINAL_ENV = { ...process.env };

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
  vi.resetModules();
  vi.clearAllMocks();
});

describe("application Prisma test boundary", () => {
  it("rejects ambient runtime DATABASE_URL before constructing a Pool", async () => {
    delete process.env.TEST_DATABASE_URL;
    process.env.DATABASE_URL =
      "postgresql://stage:secret@stage-db.example.com:5432/application";

    await expect(import("@/lib/db/prisma")).rejects.toThrow(
      /explicit local TEST_DATABASE_URL required/,
    );
    expect(mocks.pool).not.toHaveBeenCalled();
    expect(mocks.adapter).not.toHaveBeenCalled();
    expect(mocks.prismaClient).not.toHaveBeenCalled();
  });
});
