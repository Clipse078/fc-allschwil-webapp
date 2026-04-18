export type DressingRoomCode =
  | "E1"
  | "E2"
  | "E3"
  | "E4"
  | "O1"
  | "O2"
  | "O3"
  | "O4";

export type DressingRoomDefinition = {
  code: DressingRoomCode;
  label: string;
  area: "E" | "O";
  sortOrder: number;
};

export const FCA_DRESSING_ROOMS: DressingRoomDefinition[] = [
  { code: "E1", label: "E1", area: "E", sortOrder: 10 },
  { code: "E2", label: "E2", area: "E", sortOrder: 20 },
  { code: "E3", label: "E3", area: "E", sortOrder: 30 },
  { code: "E4", label: "E4", area: "E", sortOrder: 40 },
  { code: "O1", label: "O1", area: "O", sortOrder: 50 },
  { code: "O2", label: "O2", area: "O", sortOrder: 60 },
  { code: "O3", label: "O3", area: "O", sortOrder: 70 },
  { code: "O4", label: "O4", area: "O", sortOrder: 80 },
];

export function getDressingRoomByCode(code: string | null | undefined) {
  if (!code) {
    return null;
  }

  return FCA_DRESSING_ROOMS.find((item) => item.code === code) ?? null;
}