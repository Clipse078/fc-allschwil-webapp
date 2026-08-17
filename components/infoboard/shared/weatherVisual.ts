export type WeatherIconFamily =
  | "sun"
  | "cloud-sun"
  | "cloud"
  | "cloud-rain"
  | "snow"
  | "fog"
  | "storm";

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

  if (
    conditionCode >= 1 &&
    conditionCode <= 2
  ) {
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

  if (
    conditionCode === 45 ||
    conditionCode === 48
  ) {
    return {
      iconFamily: "fog",
      color: "#A7B0BA",
    };
  }

  if (
    conditionCode >= 51 &&
    conditionCode <= 69
  ) {
    return {
      iconFamily: "cloud-rain",
      color: "#6FB7E9",
    };
  }

  if (
    conditionCode >= 71 &&
    conditionCode <= 86
  ) {
    return {
      iconFamily: "snow",
      color: "#B8DDF5",
    };
  }

  if (
    conditionCode >= 95 &&
    conditionCode <= 99
  ) {
    return {
      iconFamily: "storm",
      color: "#A78BFA",
    };
  }

  return {
    iconFamily: "cloud",
    color: "#9FB3C8",
  };
}
