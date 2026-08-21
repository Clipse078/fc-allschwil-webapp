import { describe, expect, it } from "vitest";
import { filterCoordinatorsBySearch, matchesCoordinatorSearch } from "../coordinator-search";
import type { AssignableUser } from "../workflow-types";

const users: AssignableUser[] = [
  { id: "1", firstName: "Michael", lastName: "Duijster", email: "michael@example.com" },
  { id: "2", firstName: "FC", lastName: "Admin", email: "admin@fcallschwil.ch" },
  { id: "3", firstName: "Sandra", lastName: "Meier", email: "sandra.meier@example.com" },
];

describe("coordinator-search", () => {
  it("matches prefix on first name, last name, and email local part", () => {
    expect(matchesCoordinatorSearch(users[0], "mi")).toBe(true);
    expect(matchesCoordinatorSearch(users[2], "san")).toBe(true);
    expect(matchesCoordinatorSearch(users[0], "michael@")).toBe(true);
  });

  it('does not match "mi" inside unrelated tokens such as Admin', () => {
    expect(matchesCoordinatorSearch(users[1], "mi")).toBe(false);
  });

  it("returns empty results for short queries", () => {
    expect(filterCoordinatorsBySearch(users, "m")).toEqual([]);
  });

  it("returns only matching humans for a valid query", () => {
    expect(filterCoordinatorsBySearch(users, "mi").map((u) => u.id)).toEqual(["1"]);
  });
});
