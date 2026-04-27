export type DiplomaRequirement = "D-Diplom" | "C-Diplom" | "B-Diplom" | null;

export function getDiplomaRequirement(category: string | null, ageGroup: string | null): DiplomaRequirement {
  const normalizedCategory = String(category ?? "").toUpperCase();
  const normalizedAgeGroup = String(ageGroup ?? "").toUpperCase();

  if (["G", "F", "E"].includes(normalizedAgeGroup) || normalizedCategory.includes("KINDERFUSSBALL")) {
    return "D-Diplom";
  }

  if (["C", "B", "A"].includes(normalizedAgeGroup) || normalizedCategory.includes("JUNIOREN")) {
    return "C-Diplom";
  }

  if (normalizedCategory.includes("AKTIVE") || normalizedAgeGroup.includes("AKTIVE")) {
    return "B-Diplom";
  }

  return null;
}

export function diplomaMatchesRequirement(label: string, requirement: DiplomaRequirement) {
  if (!requirement) return true;

  const normalized = label.toUpperCase();

  if (requirement === "D-Diplom") {
    return normalized.includes("D-DIPLOM") || normalized.includes("SFV D") || normalized.includes("KINDERFUSSBALL");
  }

  if (requirement === "C-Diplom") {
    return normalized.includes("C-DIPLOM") || normalized.includes("UEFA C");
  }

  if (requirement === "B-Diplom") {
    return normalized.includes("B-DIPLOM") || normalized.includes("UEFA B");
  }

  return false;
}

export function isDiplomaRequirementMet(requirement: DiplomaRequirement, diplomaLabels: string[]) {
  if (!requirement) return true;
  return diplomaLabels.some((label) => diplomaMatchesRequirement(label, requirement));
}

export function getDiplomaRequirementLabel(requirement: DiplomaRequirement) {
  return requirement ?? "Keine Anforderung";
}
