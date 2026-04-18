export type WochenplanEventAllocation = {
  pitchCode: string | null;
  homeDressingRoomCode: string | null;
  awayDressingRoomCode: string | null;
  publishedToWebsite: boolean;
  publishedToInfoboard: boolean;
};

export type WochenplanEventItem = {
  id: string;
  title: string;
  eventType: string;
  source: string;
  status: string;
  teamName: string | null;
  opponentName: string | null;
  organizerName: string | null;
  competitionLabel: string | null;
  startAt: Date | string;
  endAt: Date | string | null;
  location: string | null;
  allocation: WochenplanEventAllocation;
};

export type WochenplanConflictType =
  | "PITCH_CONFLICT"
  | "DRESSING_ROOM_CONFLICT"
  | "INVALID_PITCH_MODE"
  | "MISSING_PITCH"
  | "MISSING_DRESSING_ROOM";

export type WochenplanConflictSeverity =
  | "error"
  | "warning";

export type WochenplanConflict = {
  type: WochenplanConflictType;
  severity: WochenplanConflictSeverity;
  eventId: string;
  relatedEventId: string | null;
  message: string;
};

export type WochenplanWeekGroup = {
  isoDate: string;
  weekdayLabel: string;
  calendarWeek: number;
  events: WochenplanEventItem[];
  conflicts: WochenplanConflict[];
};

export type WochenplanBoardDayKey =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY";

export type WochenplanBoardPitchRowKey =
  | "STADION"
  | "KUNSTRASEN_2"
  | "KUNSTRASEN_3";

export type WochenplanBoardSlotKey =
  | "15:45-17:15"
  | "17:15-18:45"
  | "18:45-20:15"
  | "20:15-21:45";

export type WochenplanBoardCategoryKey =
  | "KINDERFUSSBALL"
  | "JUNIOREN"
  | "AKTIVE"
  | "FRAUEN"
  | "SENIOREN"
  | "TRAINER";

export type WochenplanBoardEvent = WochenplanEventItem & {
  boardDayKey: WochenplanBoardDayKey;
  slotKey: WochenplanBoardSlotKey;
  pitchRowKey: WochenplanBoardPitchRowKey;
  fieldLabel: "A" | "B" | null;
  homeLabel: string | null;
  coachLabel: string | null;
  categoryKey: WochenplanBoardCategoryKey;
};