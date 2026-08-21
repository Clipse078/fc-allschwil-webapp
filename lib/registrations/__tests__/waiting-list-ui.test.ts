import { describe, expect, it } from "vitest";
import {
  getWaitingListNextStep,
  resolveWaitingListWorkflowState,
} from "../waiting-list-ui";

describe("waiting-list-ui", () => {
  it("derives operational next steps from status", () => {
    expect(getWaitingListNextStep("WAITING")).toBe("Kontakt aufnehmen");
    expect(getWaitingListNextStep("CONTACTED")).toBe("Angebot / Platzierung klären");
    expect(getWaitingListNextStep("OFFERED")).toBe("Rückmeldung abwarten / Platzierung vorbereiten");
    expect(getWaitingListNextStep("PLACED")).toBe("Abgeschlossen");
    expect(getWaitingListNextStep("REJECTED")).toBe("Kein weiterer aktiver Schritt");
  });

  it("maps workflow progression without forcing terminal outcomes into the happy path", () => {
    const waiting = resolveWaitingListWorkflowState({
      status: "WAITING",
      addedAt: "2026-01-01T10:00:00.000Z",
    });
    expect(waiting.currentIndex).toBe(0);
    expect(waiting.terminal).toBe(false);

    const rejected = resolveWaitingListWorkflowState({
      status: "REJECTED",
      addedAt: "2026-01-01T10:00:00.000Z",
      lastContactedAt: "2026-01-02T10:00:00.000Z",
      resolvedAt: "2026-01-03T10:00:00.000Z",
    });
    expect(rejected.terminal).toBe(true);
    expect(rejected.terminalStatus).toBe("REJECTED");
    expect(rejected.currentIndex).toBe(4);
  });
});
