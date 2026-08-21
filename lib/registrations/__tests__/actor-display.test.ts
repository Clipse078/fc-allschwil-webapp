import { describe, expect, it } from "vitest";
import { resolveAuditActorDisplayName } from "../actor-display";

describe("resolveAuditActorDisplayName", () => {
  it("prefers linked Person full name over technical account label", () => {
    expect(
      resolveAuditActorDisplayName({
        firstName: "FC Allschwil",
        lastName: "Club Admin",
        email: "admin@fcallschwil.ch",
        person: {
          firstName: "Michael",
          lastName: "Duijster",
          displayName: null,
        },
      }),
    ).toBe("Michael Duijster");
  });

  it("uses person displayName when present", () => {
    expect(
      resolveAuditActorDisplayName({
        firstName: "FC Allschwil",
        lastName: "Club Admin",
        email: "admin@fcallschwil.ch",
        person: {
          firstName: "Michael",
          lastName: "Duijster",
          displayName: "Michael Duijster",
        },
      }),
    ).toBe("Michael Duijster");
  });

  it("falls back to meaningful user name, then email, then technical account name", () => {
    expect(
      resolveAuditActorDisplayName({
        firstName: "Anna",
        lastName: "Admin",
        email: "anna@example.ch",
        person: null,
      }),
    ).toBe("Anna Admin");

    expect(
      resolveAuditActorDisplayName({
        firstName: "FC Allschwil",
        lastName: "Club Admin",
        email: "admin@fcallschwil.ch",
        person: null,
      }),
    ).toBe("admin@fcallschwil.ch");

    expect(
      resolveAuditActorDisplayName({
        firstName: "FC Allschwil",
        lastName: "Club Admin",
        email: "",
        person: null,
      }),
    ).toBe("FC Allschwil Club Admin");
  });
});
