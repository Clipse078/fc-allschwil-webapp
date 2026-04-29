import { RegistrationConversionRole, RegistrationTargetGroup, RegistrationType } from "@prisma/client";

type ClassificationInput = {
  type: RegistrationType;
  dateOfBirth?: Date | null;
  gender?: string | null;
};

function getAge(dateOfBirth?: Date | null) {
  if (!dateOfBirth) return null;
  const today = new Date();
  let age = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDiff = today.getMonth() - dateOfBirth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dateOfBirth.getDate())) age -= 1;
  return age;
}

export function classifyRegistrationTargetGroup(input: ClassificationInput): RegistrationTargetGroup {
  if (input.type === "TRAINER") return "TRAINERSTAFF";
  if (input.type !== "PLAYER") return "OTHER";

  const age = getAge(input.dateOfBirth);
  const gender = String(input.gender ?? "").toLowerCase();

  if (gender.includes("female") || gender.includes("weiblich") || gender.includes("mädchen")) return "FRAUEN";
  if (age === null) return "OTHER";
  if (age <= 11) return "KINDERFUSSBALL";
  if (age <= 19) return "JUNIOREN";
  if (age <= 30) return "AKTIVE";
  return "TRAININGSGRUPPE";
}

export function getDefaultConversionRole(type: RegistrationType): RegistrationConversionRole {
  if (type === "PLAYER") return "PLAYER";
  if (type === "TRAINER") return "TRAINER";
  if (type === "STAFF") return "STAFF";
  return "OTHER";
}

export function getDefaultWorkflowSteps(targetGroup: RegistrationTargetGroup) {
  const baseSteps = [
    { title: "Anmeldung prüfen", description: "Kontaktangaben, Alter, Zielgruppe und Vollständigkeit prüfen.", sortOrder: 10, defaultDueDays: 2 },
    { title: "Follow-up zuweisen", description: "Zuständige Person oder Rolle für die nächste Bearbeitung festlegen.", sortOrder: 20, defaultDueDays: 4 },
    { title: "Entscheidung vorbereiten", description: "Entscheiden, ob die Anmeldung abgelehnt, zurückgezogen oder konvertiert wird.", sortOrder: 30, defaultDueDays: 7 },
  ];

  if (targetGroup === "KINDERFUSSBALL") return [...baseSteps, { title: "KiFu Koordination", description: "KiFu Koordinator prüft passende Gruppe, Kapazität und weiteres Vorgehen.", sortOrder: 40, defaultDueDays: 10 }];
  if (targetGroup === "JUNIOREN") return [...baseSteps, { title: "Junioren Koordination", description: "Junioren Koordination prüft Jahrgang, Teamstufe und mögliche Teamzuteilung.", sortOrder: 40, defaultDueDays: 10 }];
  if (targetGroup === "FRAUEN") return [...baseSteps, { title: "Frauen Koordination", description: "Frauenbereich prüft passende Mannschaft und weiteres Vorgehen.", sortOrder: 40, defaultDueDays: 10 }];
  if (targetGroup === "TRAINERSTAFF") return [...baseSteps, { title: "Trainerstaff Prüfung", description: "Trainerprofil, mögliche Funktion, Diplome und Verfügbarkeit prüfen.", sortOrder: 40, defaultDueDays: 10 }];

  return baseSteps;
}

export function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}
