type PlannerEntryPublicationBadgesProps = {
  websiteVisible: boolean;
  infoboardVisible: boolean;
  wochenplanVisible: boolean;
};

export default function PlannerEntryPublicationBadges({
  websiteVisible,
  infoboardVisible,
  wochenplanVisible,
}: PlannerEntryPublicationBadgesProps) {
  const items = [
    websiteVisible ? "Website" : null,
    wochenplanVisible ? "Wochenplanner" : null,
    infoboardVisible ? "Infoboard" : null,
  ].filter(Boolean) as string[];

  if (items.length === 0) {
    return (
      <span className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-500">
        Nicht publiziert
      </span>
    );
  }

  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((item) => (
        <span
          key={item}
          className="rounded-full border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-600"
        >
          {item}
        </span>
      ))}
    </div>
  );
}
