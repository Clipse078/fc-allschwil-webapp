import type {
  OpponentDisplayNameSource,
  OpponentDisplayTarget,
} from "./types";

function optionalTrimmedValue(
  value: string | null | undefined,
): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function requireOfficialName(value: string): string {
  const officialName = optionalTrimmedValue(value);

  if (!officialName) {
    throw new Error("Opponent officialName must not be empty.");
  }

  return officialName;
}

export function resolveOpponentDisplayName(
  opponent: OpponentDisplayNameSource,
  target: OpponentDisplayTarget,
): string {
  const officialName = requireOfficialName(
    opponent.officialName,
  );

  const shortName = optionalTrimmedValue(
    opponent.shortName,
  );

  const websiteName = optionalTrimmedValue(
    opponent.websiteName,
  );

  const infoboardName = optionalTrimmedValue(
    opponent.infoboardName,
  );

  switch (target) {
    case "ADMIN":
      return shortName ?? officialName;

    case "WEBSITE":
      return websiteName ?? shortName ?? officialName;

    case "INFOBOARD":
      return (
        infoboardName ??
        shortName ??
        websiteName ??
        officialName
      );
  }
}

export function normalizeOpponentName(
  name: string,
): string {
  if (typeof name !== "string") {
    throw new TypeError(
      "Opponent name must be a string.",
    );
  }

  const normalized = name
    .trim()
    .replace(/\s+/gu, " ")
    .toLocaleLowerCase("und");

  if (!normalized) {
    throw new Error(
      "Opponent name must not be empty.",
    );
  }

  return normalized;
}