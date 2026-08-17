import { describe, expect, it } from "vitest";

import { resolveWeatherVisual } from "../weatherVisual";

describe("resolveWeatherVisual", () => {
  it("maps sunny weather to sun + warm yellow", () => {
    expect(resolveWeatherVisual(0)).toEqual({
      iconFamily: "sun",
      color: "#F5B642",
    });
  });

  it("maps code 1 to partly sunny + warm gold", () => {
    expect(resolveWeatherVisual(1)).toEqual({
      iconFamily: "cloud-sun",
      color: "#E8C56A",
    });
  });

  it("maps code 2 to partly sunny + warm gold", () => {
    expect(resolveWeatherVisual(2)).toEqual({
      iconFamily: "cloud-sun",
      color: "#E8C56A",
    });
  });

  it("maps code 3 to cloud + cool grey-blue", () => {
    expect(resolveWeatherVisual(3)).toEqual({
      iconFamily: "cloud",
      color: "#9FB3C8",
    });
  });

  it("maps MeteoSwiss rain code 61 to rain + blue", () => {
    expect(resolveWeatherVisual(61)).toEqual({
      iconFamily: "cloud-rain",
      color: "#6FB7E9",
    });
  });

  it("maps the rain threshold to rain + blue", () => {
    expect(resolveWeatherVisual(51)).toEqual({
      iconFamily: "cloud-rain",
      color: "#6FB7E9",
    });
  });

  it("uses cloud + cool grey-blue as the unknown fallback", () => {
    expect(resolveWeatherVisual(10)).toEqual({
      iconFamily: "cloud",
      color: "#9FB3C8",
    });
  });
});
