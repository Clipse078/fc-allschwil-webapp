export type RoutingSuggestion =
  | "Kinderfussball"
  | "E/F Bereich"
  | "D Bereich"
  | "C Bereich"
  | "Aktive";

export function getRoutingSuggestion(birthYear: number | null | undefined) {
  if (!birthYear) {
    return null;
  }

  if (birthYear >= 2019 && birthYear <= 2020) {
    return "Kinderfussball";
  }

  if (birthYear >= 2015 && birthYear <= 2018) {
    return "E/F Bereich";
  }

  if (birthYear >= 2013 && birthYear <= 2014) {
    return "D Bereich";
  }

  if (birthYear >= 2011 && birthYear <= 2012) {
    return "C Bereich";
  }

  return "Aktive";
}
