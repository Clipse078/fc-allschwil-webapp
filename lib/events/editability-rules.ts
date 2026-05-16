export type EventEditability = {
  canReschedule: boolean;
  canEditCoreData: boolean;
  canEditAllocations: boolean;
  canPublish: boolean;
  reason: string | null;
};

export function getEventEditability(args: {
  source: string;
  eventType: string;
}) : EventEditability {
  const source = String(args.source ?? "").trim().toUpperCase();

  if (source === "CLUBCORNER_FVNWS") {
    return {
      canReschedule: false,
      canEditCoreData: false,
      canEditAllocations: true,
      canPublish: true,
      reason: "FVNWS importierte Matches und Turniere dürfen zeitlich nicht direkt verändert werden.",
    };
  }

  return {
    canReschedule: true,
    canEditCoreData: true,
    canEditAllocations: true,
    canPublish: true,
    reason: null,
  };
}