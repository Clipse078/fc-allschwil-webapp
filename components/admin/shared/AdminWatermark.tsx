import SportClubEvoMark from "@/components/shared/SportClubEvoMark";

export default function AdminWatermark() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 h-[520px] w-[520px] -translate-x-1/2 -translate-y-1/2 opacity-[0.04]">
        <SportClubEvoMark className="h-full w-full" variant="watermark" />
      </div>
    </div>
  );
}
