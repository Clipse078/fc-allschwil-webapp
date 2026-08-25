import { describe, expect, it } from "vitest";
import { formatReconciliationIssueLabel } from "../reconciliation-display";

describe("formatReconciliationIssueLabel", () => {
  it("maps known reconciliation issues to German admin labels", () => {
    expect(
      formatReconciliationIssueLabel("PAST_FIXTURE_PROVIDER_NOT_PLAYED"),
    ).toBe("Vergangenes Spiel ohne Provider-Ergebnis");
    expect(
      formatReconciliationIssueLabel("PROVIDER_COMPLETED_EVENT_NOT_COMPLETED"),
    ).toBe("Provider meldet ausgetragen, SCE noch nicht abgeschlossen");
  });

  it("falls back to a generic label when issue is null", () => {
    expect(formatReconciliationIssueLabel(null)).toBe(
      "Datenprüfung erforderlich",
    );
  });
});
