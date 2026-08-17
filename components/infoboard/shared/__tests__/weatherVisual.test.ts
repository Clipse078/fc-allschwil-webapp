import {
  describe,
  expect,
  it,
} from "vitest";

import {
  resolveWeatherVisual,
} from "../weatherVisual";

describe("resolveWeatherVisual", () => {
  it("maps sunny weather", () => {
    expect(
      resolveWeatherVisual(0),
    ).toEqual({
      iconFamily: "sun",
      color: "#F5B642",
    });
  });

  it("maps partly sunny weather", () => {
    expect(
      resolveWeatherVisual(2),
    ).toEqual({
      iconFamily: "cloud-sun",
      color: "#E8C56A",
    });
  });

  it("maps cloudy weather", () => {
    expect(
      resolveWeatherVisual(3),
    ).toEqual({
      iconFamily: "cloud",
      color: "#9FB3C8",
    });
  });

  it("maps fog distinctly", () => {
    expect(
      resolveWeatherVisual(45),
    ).toEqual({
      iconFamily: "fog",
      color: "#A7B0BA",
    });
  });

  it("maps rain distinctly", () => {
    expect(
      resolveWeatherVisual(61),
    ).toEqual({
      iconFamily: "cloud-rain",
      color: "#6FB7E9",
    });
  });

  it("maps snow distinctly", () => {
    expect(
      resolveWeatherVisual(71),
    ).toEqual({
      iconFamily: "snow",
      color: "#B8DDF5",
    });
  });

  it("maps thunderstorm distinctly", () => {
    expect(
      resolveWeatherVisual(95),
    ).toEqual({
      iconFamily: "storm",
      color: "#A78BFA",
    });
  });

  it("uses cloud fallback for unknown values", () => {
    expect(
      resolveWeatherVisual(10),
    ).toEqual({
      iconFamily: "cloud",
      color: "#9FB3C8",
    });
  });
});
