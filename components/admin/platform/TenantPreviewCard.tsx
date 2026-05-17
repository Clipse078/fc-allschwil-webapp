import { Building2, CheckCircle2, Globe, LayoutDashboard, Smartphone, Monitor } from "lucide-react";

type TenantPreviewCardProps = {
  displayName: string;
  shortName?: string;
  slug: string;
  sportType: string;
  primaryColor: string;
  secondaryColor?: string;
  logoUrl?: string;
  isActive: boolean;
};

const ECOSYSTEM_MODULES = [
  { id: "webapp",    label: "WebApp",    icon: Monitor,       active: true },
  { id: "website",   label: "Website",   icon: Globe,         active: false },
  { id: "infoboard", label: "InfoBoard", icon: LayoutDashboard, active: false },
  { id: "mobile",    label: "Mobile App", icon: Smartphone,   active: false },
] as const;

export default function TenantPreviewCard({
  displayName,
  shortName,
  slug,
  sportType,
  primaryColor,
  secondaryColor,
  logoUrl,
  isActive,
}: TenantPreviewCardProps) {
  const color = primaryColor || "#0b4aa2";
  const sec = secondaryColor || "#4a6fd1";

  return (
    <div className="space-y-4">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
        Club Preview
      </p>

      {/* Sidebar chip preview */}
      <div>
        <p className="mb-2 text-[10px] text-slate-400">Sidebar chip</p>
        <div
          className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold text-white"
          style={{ backgroundColor: color }}
        >
          <Building2 className="h-3 w-3" />
          {displayName || "Club Name"}
        </div>
      </div>

      {/* Full branding card */}
      <div
        className="overflow-hidden rounded-[20px] border shadow-md"
        style={{ borderColor: `${color}30` }}
      >
        {/* Header band with tenant branding */}
        <div
          className="flex items-center gap-3 px-5 py-4"
          style={{
            background: `linear-gradient(135deg, ${color} 0%, ${sec} 100%)`,
          }}
        >
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={displayName} className="h-10 w-10 rounded-lg object-contain bg-white/20 p-1" />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/20 text-white"
              style={{ border: "1px solid rgba(255,255,255,0.25)" }}
            >
              <Building2 className="h-5 w-5" />
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-[0.65rem] font-semibold uppercase tracking-widest text-white/55">
              {sportType}
            </p>
            <p className="font-[var(--font-display)] text-lg font-black uppercase leading-tight tracking-tight text-white">
              {displayName || "Club Name"}
            </p>
            {shortName ? (
              <p className="text-[0.72rem] font-semibold text-white/70">{shortName}</p>
            ) : null}
          </div>
          {/* SCE attribution */}
          <div className="shrink-0 flex flex-col items-end gap-0.5">
            <p className="text-[0.55rem] font-bold uppercase tracking-widest text-white/30">
              powered by
            </p>
            <p className="text-[0.62rem] font-black uppercase tracking-wide text-white/50">
              SCE
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="bg-white px-5 py-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-slate-400">Tenant slug</p>
              <code className="mt-0.5 block rounded bg-slate-100 px-2 py-0.5 text-[11px] font-mono text-slate-600">
                {slug}
              </code>
            </div>
            {isActive ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700">
                <CheckCircle2 className="h-3 w-3" />
                Active
              </span>
            ) : (
              <span className="inline-block rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-400">
                Inactive
              </span>
            )}
          </div>

          {/* Color swatches */}
          <div className="mt-3 flex items-center gap-2">
            <div
              className="h-6 w-6 rounded-full border-2 border-white shadow"
              style={{ backgroundColor: color }}
              title={`Primary: ${color}`}
            />
            {sec !== color ? (
              <div
                className="h-6 w-6 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: sec }}
                title={`Secondary: ${sec}`}
              />
            ) : null}
            <span className="text-[10px] text-slate-400">Brand colours</span>
          </div>
        </div>

        {/* Ecosystem module strip */}
        <div className="border-t border-slate-100 bg-slate-50/80 px-5 py-3">
          <p className="mb-2 text-[9.5px] font-bold uppercase tracking-[0.2em] text-slate-400">
            SCE Ecosystem
          </p>
          <div className="flex flex-wrap gap-1.5">
            {ECOSYSTEM_MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <span
                  key={mod.id}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    mod.active
                      ? "border border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border border-slate-200 bg-white text-slate-400"
                  }`}
                >
                  <Icon className="h-2.5 w-2.5" />
                  {mod.label}
                  {!mod.active ? (
                    <span className="ml-0.5 text-[8px] font-bold uppercase text-slate-300">·soon</span>
                  ) : null}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-slate-400">
        This is how your club appears across the SportClubEvo platform — in headers, tenant chips, and public pages.
      </p>
    </div>
  );
}
