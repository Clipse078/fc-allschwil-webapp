import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveOpponentDisplayName,
} from "../display-name";

const opponent = {
  officialName: "FC Basel 1893",
  shortName: "FC Basel",
  websiteName: "Basel",
  infoboardName: "FCB",
};

describe("resolveOpponentDisplayName", () => {
  it("prefers shortName for ADMIN", () => {
    expect(
      resolveOpponentDisplayName(
        opponent,
        "ADMIN",
      ),
    ).toBe("FC Basel");
  });

  it("falls back to officialName for ADMIN", () => {
    expect(
      resolveOpponentDisplayName(
        {
          ...opponent,
          shortName: null,
        },
        "ADMIN",
      ),
    ).toBe("FC Basel 1893");
  });

  it("prefers websiteName for WEBSITE", () => {
    expect(
      resolveOpponentDisplayName(
        opponent,
        "WEBSITE",
      ),
    ).toBe("Basel");
  });

  it("falls back to shortName for WEBSITE", () => {
    expect(
      resolveOpponentDisplayName(
        {
          ...opponent,
          websiteName: null,
        },
        "WEBSITE",
      ),
    ).toBe("FC Basel");
  });

  it("falls back to officialName for WEBSITE", () => {
    expect(
      resolveOpponentDisplayName(
        {
          ...opponent,
          websiteName: null,
          shortName: null,
        },
        "WEBSITE",
      ),
    ).toBe("FC Basel 1893");
  });

  it("prefers infoboardName for INFOBOARD", () => {
    expect(
      resolveOpponentDisplayName(
        opponent,
        "INFOBOARD",
      ),
    ).toBe("FCB");
  });

  it("falls back to shortName for INFOBOARD", () => {
    expect(
      resolveOpponentDisplayName(
        {
          ...opponent,
          infoboardName: null,
        },
        "INFOBOARD",
      ),
    ).toBe("FC Basel");
  });

  it("falls back from shortName to websiteName for INFOBOARD", () => {
    expect(
      resolveOpponentDisplayName(
        {
          ...opponent,
          infoboardName: null,
          shortName: null,
        },
        "INFOBOARD",
      ),
    ).toBe("Basel");
  });

  it("falls back to officialName for INFOBOARD", () => {
    expect(
      resolveOpponentDisplayName(
        {
          ...opponent,
          infoboardName: null,
          shortName: null,
          websiteName: null,
        },
        "INFOBOARD",
      ),
    ).toBe("FC Basel 1893");
  });

  it("ignores blank override strings", () => {
    expect(
      resolveOpponentDisplayName(
        {
          officialName: " FC Basel 1893 ",
          shortName: "   ",
          websiteName: "\t",
          infoboardName: "\n",
        },
        "INFOBOARD",
      ),
    ).toBe("FC Basel 1893");
  });

  it("does not mutate the input object", () => {
    const input = {
      officialName: " FC Basel 1893 ",
      shortName: " FC Basel ",
      websiteName: " Basel ",
      infoboardName: " FCB ",
    };

    const snapshot = {
      ...input,
    };

    resolveOpponentDisplayName(
      input,
      "INFOBOARD",
    );

    expect(input).toEqual(snapshot);
  });

  it("rejects a blank officialName", () => {
    expect(() =>
      resolveOpponentDisplayName(
        {
          officialName: "   ",
        },
        "ADMIN",
      ),
    ).toThrow(
      "Opponent officialName must not be empty.",
    );
  });
});