export const WOCHENPLAN_TIME_SLOTS = [
  {
    key: "15:45-17:15",
    label: "15:45–17:15",
    startHour: 15,
    startMinute: 45,
    endHour: 17,
    endMinute: 15,
    sortOrder: 0,
  },
  {
    key: "17:15-18:45",
    label: "17:15–18:45",
    startHour: 17,
    startMinute: 15,
    endHour: 18,
    endMinute: 45,
    sortOrder: 1,
  },
  {
    key: "18:45-20:15",
    label: "18:45–20:15",
    startHour: 18,
    startMinute: 45,
    endHour: 20,
    endMinute: 15,
    sortOrder: 2,
  },
  {
    key: "20:15-21:45",
    label: "20:15–21:45",
    startHour: 20,
    startMinute: 15,
    endHour: 21,
    endMinute: 45,
    sortOrder: 3,
  },
] as const;

export type WochenplanBoardSlotKey = (typeof WOCHENPLAN_TIME_SLOTS)[number]["key"];

export function getWochenplanTimeSlotKeys(): WochenplanBoardSlotKey[] {
  return WOCHENPLAN_TIME_SLOTS.map((slot) => slot.key);
}

export function getWochenplanTimeSlot(key: WochenplanBoardSlotKey) {
  return WOCHENPLAN_TIME_SLOTS.find((slot) => slot.key === key) ?? WOCHENPLAN_TIME_SLOTS[0];
}

export function snapDateToWochenplanSlot(
  date: Date,
  toleranceMinutes = 45,
): WochenplanBoardSlotKey | null {
  const minutesInDay = date.getUTCHours() * 60 + date.getUTCMinutes();

  let best: { slot: WochenplanBoardSlotKey; distance: number } | null = null;

  for (const slot of WOCHENPLAN_TIME_SLOTS) {
    const startMin = slot.startHour * 60 + slot.startMinute;
    const distance = Math.abs(minutesInDay - startMin);

    if (!best || distance < best.distance) {
      best = { slot: slot.key, distance };
    }
  }

  if (best && best.distance <= toleranceMinutes) {
    return best.slot;
  }

  return null;
}
