/**
 * Tests for lib/competitions/validators.ts
 *
 * Covers:
 *   A. validateCreateCompetitionInput — valid, invalid fields
 *   B. validateUpdateCompetitionInput — valid, invalid fields
 */

import { describe, it, expect } from "vitest";
import {
  validateCreateCompetitionInput,
  validateUpdateCompetitionInput,
  CompetitionValidationError,
} from "../validators";

describe("A. validateCreateCompetitionInput", () => {
  it("accepts valid minimal input", () => {
    expect(() =>
      validateCreateCompetitionInput({ provider: "SFV", officialName: "Liga A" }),
    ).not.toThrow();
  });

  it("accepts full valid input", () => {
    expect(() =>
      validateCreateCompetitionInput({
        provider: "SFV",
        officialName: "3. Liga",
        shortName: "3L",
        groupName: "Gruppe 1",
        competitionType: "LEAGUE",
        gender: "FEMALE",
        ageCategory: "U15",
        externalCompetitionId: 101,
        externalSeasonId: 2027,
      }),
    ).not.toThrow();
  });

  it("rejects empty provider", () => {
    expect(() =>
      validateCreateCompetitionInput({ provider: "", officialName: "Liga" }),
    ).toThrow(CompetitionValidationError);
  });

  it("rejects empty officialName", () => {
    expect(() =>
      validateCreateCompetitionInput({ provider: "SFV", officialName: "   " }),
    ).toThrow(CompetitionValidationError);
  });

  it("rejects invalid competitionType", () => {
    expect(() =>
      validateCreateCompetitionInput({
        provider: "SFV",
        officialName: "Liga",
        competitionType: "INVALID" as never,
      }),
    ).toThrow(CompetitionValidationError);
  });

  it("rejects invalid gender", () => {
    expect(() =>
      validateCreateCompetitionInput({
        provider: "SFV",
        officialName: "Liga",
        gender: "UNKNOWN" as never,
      }),
    ).toThrow(CompetitionValidationError);
  });

  it("rejects officialName exceeding max length", () => {
    expect(() =>
      validateCreateCompetitionInput({
        provider: "SFV",
        officialName: "A".repeat(256),
      }),
    ).toThrow(CompetitionValidationError);
  });

  it("rejects non-integer externalCompetitionId", () => {
    expect(() =>
      validateCreateCompetitionInput({
        provider: "SFV",
        officialName: "Liga",
        externalCompetitionId: 1.5,
      }),
    ).toThrow(CompetitionValidationError);
  });
});

describe("B. validateUpdateCompetitionInput", () => {
  it("accepts empty input (no-op update)", () => {
    expect(() => validateUpdateCompetitionInput({})).not.toThrow();
  });

  it("accepts valid partial update", () => {
    expect(() =>
      validateUpdateCompetitionInput({ shortName: "3L", isArchived: true }),
    ).not.toThrow();
  });

  it("rejects invalid competitionType", () => {
    expect(() =>
      validateUpdateCompetitionInput({ competitionType: "BAD" as never }),
    ).toThrow(CompetitionValidationError);
  });

  it("rejects shortName exceeding max length", () => {
    expect(() =>
      validateUpdateCompetitionInput({ shortName: "A".repeat(51) }),
    ).toThrow(CompetitionValidationError);
  });
});
