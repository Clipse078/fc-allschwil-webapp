export default function AdminWatermark() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="absolute left-1/2 top-1/2 -translate-x-[42%] -translate-y-1/2 rotate-[10deg]">
        <img
          src="/images/logos/fc-allschwil.png"
          alt="FC Allschwil watermark"
          className="w-[520px] max-w-[62vw] opacity-[0.03]"
        />
      </div>
    </div>
  );
}
