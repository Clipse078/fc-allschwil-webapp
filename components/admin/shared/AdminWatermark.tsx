export default function AdminWatermark() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 -translate-x-[42%] -translate-y-1/2 rotate-[10deg]">
        <span
          className="select-none font-[var(--font-display)] text-[18vw] font-black uppercase leading-none tracking-[-0.05em] text-slate-900/[0.018]"
          aria-hidden="true"
        >
          SCE
        </span>
      </div>
    </div>
  );
}
