export type DiplomaRequirement = "D-Diplom" | "C-Diplom" | "B-Diplom" | null;

export function getDiplomaRequirement(category: string | null, ageGroup: string | null): DiplomaRequirement {
  const cat = String(category ?? "").toUpperCase();
  const age = String(ageGroup ?? "").toUpperCase();

  if (["G","F","E"].includes(age) || cat.includes("KINDERFUSSBALL")) return "D-Diplom";
  if (["C","B","A"].includes(age) || cat.includes("JUNIOREN")) return "C-Diplom";
  if (cat.includes("AKTIVE")) return "B-Diplom";

  return null;
}

export function isRequirementMet(requirement: DiplomaRequirement, diplomas: string[]) {
  if (!requirement) return true;

  const all = diplomas.join(" ").toUpperCase();

  if (requirement === "D-Diplom") {
    return all.includes("D-DIPLOM") || all.includes("SFV D") || all.includes("KINDERFUSSBALL");
  }

  if (requirement === "C-Diplom") {
    return all.includes("C-DIPLOM") || all.includes("UEFA C");
  }

  if (requirement === "B-Diplom") {
    return all.includes("B-DIPLOM") || all.includes("UEFA B");
  }

  return false;
}
