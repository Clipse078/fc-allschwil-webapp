import {
  describe,
  expect,
  it,
} from "vitest";

import {
  METEOSWISS_E4_POINT_ID,
  METEOSWISS_E4_POINT_TYPE_ID,
  conditionFamilyToCode,
  parseAllschwilE4Condition,
  parseE4Timestamp,
  resolveMeteoSwissSymbol,
  selectLatestApplicableAsset,
} from "../providers/meteoswiss-e4-weather-provider";

describe("MeteoSwiss E4 canonical point", () => {
  it("uses the Allschwil postal-code center", () => {
    expect(METEOSWISS_E4_POINT_ID).toBe("412300");
    expect(METEOSWISS_E4_POINT_TYPE_ID).toBe("2");
  });
});

describe("official MeteoSwiss symbol mapping", () => {
  it("maps code 1 to sunny", () => {
    expect(
      resolveMeteoSwissSymbol(1),
    ).toEqual({
      family: "sunny",
      label: "Sonnig",
    });
  });

  it("maps code 3 to partly sunny", () => {
    expect(
      resolveMeteoSwissSymbol(3),
    ).toEqual({
      family: "partly-cloudy",
      label: "Teilweise sonnig",
    });
  });

  it("maps code 6 to rain showers", () => {
    expect(
      resolveMeteoSwissSymbol(6),
    ).toEqual({
      family: "rain",
      label: "Einzelne Regenschauer",
    });
  });

  it("maps code 14 to weak rain", () => {
    expect(
      resolveMeteoSwissSymbol(14),
    ).toEqual({
      family: "rain",
      label: "Schwacher Regen",
    });
  });

  it("maps code 20 to persistent rain", () => {
    expect(
      resolveMeteoSwissSymbol(20),
    ).toEqual({
      family: "rain",
      label: "Anhaltender Regen",
    });
  });

  it("maps live code 25 to strong thunderstorm", () => {
    expect(
      resolveMeteoSwissSymbol(25),
    ).toEqual({
      family: "storm",
      label: "Stark gewitterhaft",
    });
  });

  it("maps code 26 to high cloud", () => {
    expect(
      resolveMeteoSwissSymbol(26),
    ).toEqual({
      family: "cloudy",
      label: "Hohe Bewölkung",
    });
  });

  it("maps code 28 to fog", () => {
    expect(
      resolveMeteoSwissSymbol(28),
    ).toEqual({
      family: "fog",
      label: "Nebel",
    });
  });

  it("maps nighttime code 101 to clear", () => {
    expect(
      resolveMeteoSwissSymbol(101),
    ).toEqual({
      family: "sunny",
      label: "Klar",
    });
  });

  it("maps nighttime rain code 114", () => {
    expect(
      resolveMeteoSwissSymbol(114),
    ).toEqual({
      family: "rain",
      label: "Schwacher Regen",
    });
  });

  it("maps nighttime storm code 125", () => {
    expect(
      resolveMeteoSwissSymbol(125),
    ).toEqual({
      family: "storm",
      label: "Stark gewitterhaft",
    });
  });

  it("keeps unknown codes unsupported", () => {
    expect(
      resolveMeteoSwissSymbol(40),
    ).toBeNull();

    expect(
      resolveMeteoSwissSymbol(41),
    ).toBeNull();

    expect(
      resolveMeteoSwissSymbol(999),
    ).toBeNull();
  });
});

describe("canonical UI family codes", () => {
  it("maps all visual families distinctly", () => {
    expect(
      conditionFamilyToCode("sunny"),
    ).toBe(0);

    expect(
      conditionFamilyToCode("partly-cloudy"),
    ).toBe(2);

    expect(
      conditionFamilyToCode("cloudy"),
    ).toBe(3);

    expect(
      conditionFamilyToCode("fog"),
    ).toBe(45);

    expect(
      conditionFamilyToCode("rain"),
    ).toBe(61);

    expect(
      conditionFamilyToCode("snow"),
    ).toBe(71);

    expect(
      conditionFamilyToCode("storm"),
    ).toBe(95);
  });
});

describe("E4 timestamp / asset selection", () => {
  it("parses MeteoSwiss UTC timestamp", () => {
    expect(
      parseE4Timestamp(
        "202608171000",
      ),
    ).toBe(
      "2026-08-17T10:00:00.000Z",
    );
  });

  it("selects latest applicable asset", () => {
    const result =
      selectLatestApplicableAsset(
        {
          id: "20260817-ch",
          assets: {
            "vnut12.lssw.202608170900.jww003i0.csv": {
              href: "09.csv",
            },

            "vnut12.lssw.202608171000.jww003i0.csv": {
              href: "10.csv",
            },

            "vnut12.lssw.202608171100.jww003i0.csv": {
              href: "11.csv",
            },
          },
        },

        new Date(
          "2026-08-17T10:30:00.000Z",
        ),
      );

    expect(result).toBe("10.csv");
  });
});

describe("Allschwil E4 parsing", () => {
  it("maps the discovered live code 25 to thunderstorm", () => {
    const csv = [
      "point_id;point_type_id;Date;jww003i0",
      "412300;2;202608170900;13",
      "412300;2;202608171000;25",
      "412300;2;202608171100;20",
    ].join("\n");

    expect(
      parseAllschwilE4Condition(
        csv,
        new Date(
          "2026-08-17T10:30:00.000Z",
        ),
      ),
    ).toEqual({
      isAvailable: true,

      value: {
        symbolCode: 25,
        forecastAt:
          "2026-08-17T10:00:00.000Z",

        conditionCode: 95,
        conditionLabel:
          "Stark gewitterhaft",
      },
    });
  });

  it("continues to reject unknown symbol codes", () => {
    const csv = [
      "point_id;point_type_id;Date;jww003i0",
      "412300;2;202608171000;40",
    ].join("\n");

    expect(
      parseAllschwilE4Condition(
        csv,
        new Date(
          "2026-08-17T10:30:00.000Z",
        ),
      ),
    ).toEqual({
      isAvailable: false,
    });
  });
});
