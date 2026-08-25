import { describe, expect, it } from "vitest";
import {
  classifySportingMatchLifecycle,
  isSportingMatchInResultsList,
  isSportingMatchInUpcomingList,
} from "../lifecycle";
import { classifyProviderMatchDisposition } from "../provider-state";

const NOW = new Date("2026-08-25T12:00:00.000Z");

describe("classifyProviderMatchDisposition", () => {
  it("recognises noch nicht ausgetragen as NOT_PLAYED", () => {
    expect(classifyProviderMatchDisposition("noch nicht ausgetragen")).toBe(
      "NOT_PLAYED",
    );
  });

  it("recognises ausgetragen as COMPLETED", () => {
    expect(classifyProviderMatchDisposition("ausgetragen")).toBe("COMPLETED");
  });

  it("recognises verschoben as POSTPONED", () => {
    expect(classifyProviderMatchDisposition("verschoben")).toBe("POSTPONED");
  });

  it("recognises abgesagt as CANCELLED", () => {
    expect(classifyProviderMatchDisposition("abgesagt")).toBe("CANCELLED");
  });
});

describe("classifySportingMatchLifecycle", () => {
  it("1. future scheduled → UPCOMING", () => {
    expect(
      classifySportingMatchLifecycle({
        status: "SCHEDULED",
        startAt: new Date("2026-09-05T16:00:00.000Z"),
        providerMatchStateName: "noch nicht ausgetragen",
        now: NOW,
      }).lifecycle,
    ).toBe("UPCOMING");
  });

  it("2. past ausgetragen → COMPLETED", () => {
    expect(
      classifySportingMatchLifecycle({
        status: "SCHEDULED",
        startAt: new Date("2026-08-02T16:00:00.000Z"),
        providerMatchStateName: "ausgetragen",
        now: NOW,
      }).lifecycle,
    ).toBe("COMPLETED");
  });

  it("3. past noch nicht ausgetragen → NEEDS_RECONCILIATION", () => {
    expect(
      classifySportingMatchLifecycle({
        status: "SCHEDULED",
        startAt: new Date("2026-08-02T16:00:00.000Z"),
        providerMatchStateName: "noch nicht ausgetragen",
        now: NOW,
      }).lifecycle,
    ).toBe("NEEDS_RECONCILIATION");
  });

  it("6. postponed → POSTPONED", () => {
    expect(
      classifySportingMatchLifecycle({
        status: "SCHEDULED",
        startAt: new Date("2026-09-05T16:00:00.000Z"),
        providerMatchStateName: "verschoben",
        now: NOW,
      }).lifecycle,
    ).toBe("POSTPONED");
  });

  it("past postponed is excluded from Spielplanung upcoming list", () => {
    expect(
      isSportingMatchInUpcomingList("POSTPONED", {
        includePostponed: true,
        startAt: new Date("2026-08-02T16:00:00.000Z"),
        now: NOW,
      }),
    ).toBe(false);
  });

  it("future postponed remains in Spielplanung upcoming list", () => {
    expect(
      isSportingMatchInUpcomingList("POSTPONED", {
        includePostponed: true,
        startAt: new Date("2026-09-05T16:00:00.000Z"),
        now: NOW,
      }),
    ).toBe(true);
  });

  it("7. cancelled → CANCELLED", () => {
    expect(
      classifySportingMatchLifecycle({
        status: "SCHEDULED",
        startAt: new Date("2026-09-05T16:00:00.000Z"),
        providerMatchStateName: "abgesagt",
        now: NOW,
      }).lifecycle,
    ).toBe("CANCELLED");
  });

  it("flags provider completed + SCE scheduled as reconciliation issue", () => {
    const result = classifySportingMatchLifecycle({
      status: "SCHEDULED",
      startAt: new Date("2026-08-02T16:00:00.000Z"),
      providerMatchStateName: "ausgetragen",
      now: NOW,
    });

    expect(result.lifecycle).toBe("COMPLETED");
    expect(result.reconciliationIssue).toBe(
      "PROVIDER_COMPLETED_EVENT_NOT_COMPLETED",
    );
  });

  it("8. no overlap between upcoming and results buckets", () => {
    const lifecycles = [
      "UPCOMING",
      "LIVE",
      "COMPLETED",
      "POSTPONED",
      "CANCELLED",
      "NEEDS_RECONCILIATION",
    ] as const;

    for (const lifecycle of lifecycles) {
      const inUpcoming = isSportingMatchInUpcomingList(lifecycle, {
        includePostponed: true,
        startAt: new Date("2026-09-05T16:00:00.000Z"),
        now: NOW,
      });
      const inResults = isSportingMatchInResultsList(lifecycle);
      expect(inUpcoming && inResults).toBe(false);
    }
  });
});
