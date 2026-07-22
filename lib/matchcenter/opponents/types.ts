export type OpponentDisplayTarget =
  | "ADMIN"
  | "WEBSITE"
  | "INFOBOARD";

export type OpponentDisplayNameSource = {
  officialName: string;
  shortName?: string | null;
  websiteName?: string | null;
  infoboardName?: string | null;
};