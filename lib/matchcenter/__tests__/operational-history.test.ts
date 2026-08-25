import { describe, expect, it } from "vitest";
import { formatOperationalHistoryLabel } from "../operational-history";

describe("formatOperationalHistoryLabel", () => {
  it("joins pitch and dressing-room labels concisely", () => {
    expect(
      formatOperationalHistoryLabel(
        {
          pitchCode: "KR2",
          homeDressingRoomCode: "O1",
          awayDressingRoomCode: "E1",
        },
        {
          pitchOptions: [{ code: "KR2", name: "Kunstrasen 2" }],
          dressingRoomOptions: [
            { code: "O1", name: "O1" },
            { code: "E1", name: "E1" },
          ],
        },
      ),
    ).toBe("Kunstrasen 2 · Heim O1 · Gast E1");
  });

  it("returns null when no historical allocations exist", () => {
    expect(
      formatOperationalHistoryLabel({
        pitchCode: null,
        homeDressingRoomCode: null,
        awayDressingRoomCode: null,
      }),
    ).toBeNull();
  });
});
