export type WeatherIconFamily =
  | "sun"
  | "cloud-sun"
  | "cloud"
  | "cloud-rain";

export type WeatherVisual = {
  iconFamily: WeatherIconFamily;
  color: string;
};

export function resolveWeatherVisual(
  conditionCode: number,
): WeatherVisual {
  if (conditionCode === 0) {
    return {
      iconFamily: "sun",
      color: "#F5B642",
    };
  }

  if (conditionCode >= 1 && conditionCode <= 2) {
    return {
      iconFamily: "cloud-sun",
      color: "#E8C56A",
    };
  }

  if (conditionCode === 3) {
    return {
      iconFamily: "cloud",
      color: "#9FB3C8",
    };
  }

  if (conditionCode >= 51) {
    return {
      iconFamily: "cloud-rain",
      color: "#6FB7E9",
    };
  }

  return {
    iconFamily: "cloud",
    color: "#9FB3C8",
  };
}
