"use client";

const labelClass =
  "block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--muted)] mb-1.5";

export type HeroStylingValues = {
  overlayColor: string;
  overlayOpacity: number;
  gradientType: string;
  gradientFrom: string;
  gradientTo: string;
  textColor: string;
};

type HeroStylingPanelProps = {
  values: HeroStylingValues;
  onChange: (values: HeroStylingValues) => void;
  tenantPrimaryColor?: string;
  tenantSecondaryColor?: string;
};

const OVERLAY_COLOR_OPTIONS = [
  { label: "Keine", value: "" },
  { label: "Primärfarbe", value: "primary" },
  { label: "Sekundärfarbe", value: "secondary" },
  { label: "Schwarz", value: "black" },
  { label: "Weiss", value: "white" },
  { label: "Benutzerdefiniert", value: "custom" },
];

const GRADIENT_TYPE_OPTIONS = [
  { label: "Kein Gradient", value: "none" },
  { label: "Oben → Unten", value: "top-bottom" },
  { label: "Unten → Oben", value: "bottom-top" },
  { label: "Links → Rechts", value: "left-right" },
  { label: "Rechts → Links", value: "right-left" },
  { label: "Radial / Mittelglühen", value: "radial" },
];

const TEXT_COLOR_OPTIONS = [
  { label: "Hell (Weiss)", value: "light" },
  { label: "Dunkel (Schwarz)", value: "dark" },
  { label: "Benutzerdefiniert", value: "custom" },
];

function isCustomColor(value: string): boolean {
  return value !== "" && !["primary", "secondary", "black", "white", "none", "light", "dark"].includes(value) && value.startsWith("#");
}

export default function HeroStylingPanel({
  values,
  onChange,
  tenantPrimaryColor = "#0b4aa2",
  tenantSecondaryColor = "#c7332c",
}: HeroStylingPanelProps) {
  function set(key: keyof HeroStylingValues, value: string | number) {
    onChange({ ...values, [key]: value });
  }

  const overlayIsCustom = isCustomColor(values.overlayColor);
  const overlaySelectValue = overlayIsCustom ? "custom" : values.overlayColor;

  const textIsCustom = isCustomColor(values.textColor) || (values.textColor !== "" && values.textColor !== "light" && values.textColor !== "dark");
  const textSelectValue = textIsCustom ? "custom" : values.textColor;

  const gradientFromIsCustom = isCustomColor(values.gradientFrom);
  const gradientFromSelectValue = gradientFromIsCustom ? "custom" : values.gradientFrom;

  const gradientToIsCustom = isCustomColor(values.gradientTo);
  const gradientToSelectValue = gradientToIsCustom ? "custom" : values.gradientTo;

  return (
    <div className="space-y-5">
      {/* Overlay Color */}
      <div>
        <label className={labelClass}>Overlay-Farbe</label>
        <div className="flex items-center gap-2">
          {/* Color presets */}
          <div className="flex gap-1.5">
            <button
              type="button"
              title="Keine"
              onClick={() => set("overlayColor", "")}
              className={`h-6 w-6 rounded border-2 text-[9px] flex items-center justify-center ${values.overlayColor === "" ? "border-[var(--foreground)]" : "border-[var(--border)]"}`}
              style={{ background: "repeating-conic-gradient(#ccc 0% 25%, #fff 0% 50%) 0 0 / 8px 8px" }}
            >
            </button>
            <button
              type="button"
              title="Primärfarbe"
              onClick={() => set("overlayColor", "primary")}
              className={`h-6 w-6 rounded border-2 ${values.overlayColor === "primary" ? "border-[var(--foreground)]" : "border-[var(--border)]"}`}
              style={{ background: tenantPrimaryColor }}
            />
            <button
              type="button"
              title="Sekundärfarbe"
              onClick={() => set("overlayColor", "secondary")}
              className={`h-6 w-6 rounded border-2 ${values.overlayColor === "secondary" ? "border-[var(--foreground)]" : "border-[var(--border)]"}`}
              style={{ background: tenantSecondaryColor }}
            />
            <button
              type="button"
              title="Schwarz"
              onClick={() => set("overlayColor", "black")}
              className={`h-6 w-6 rounded border-2 bg-black ${values.overlayColor === "black" ? "border-[var(--foreground)]" : "border-[var(--border)]"}`}
            />
            <button
              type="button"
              title="Weiss"
              onClick={() => set("overlayColor", "white")}
              className={`h-6 w-6 rounded border-2 bg-white ${values.overlayColor === "white" ? "border-[var(--foreground)]" : "border-[var(--border)]"}`}
            />
          </div>
          <select
            value={overlaySelectValue}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "custom") set("overlayColor", "#000000");
              else set("overlayColor", v);
            }}
            className="fca-input text-xs flex-1"
          >
            {OVERLAY_COLOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {overlayIsCustom && (
            <input
              type="color"
              value={values.overlayColor}
              onChange={(e) => set("overlayColor", e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-[var(--border)] p-0.5"
            />
          )}
        </div>
      </div>

      {/* Overlay Opacity */}
      {values.overlayColor && (
        <div>
          <label className={labelClass}>
            Overlay-Deckkraft: {values.overlayOpacity}%
          </label>
          <input
            type="range"
            min={0}
            max={100}
            value={values.overlayOpacity}
            onChange={(e) => set("overlayOpacity", Number(e.target.value))}
            className="w-full accent-[var(--tenant-primary,#0b4aa2)]"
          />
          <div className="mt-0.5 flex justify-between text-[10px] text-[var(--muted)]">
            <span>0%</span>
            <span>100%</span>
          </div>
        </div>
      )}

      {/* Gradient Type */}
      <div>
        <label className={labelClass}>Gradient</label>
        <select
          value={values.gradientType || "none"}
          onChange={(e) => set("gradientType", e.target.value)}
          className="fca-input text-xs"
        >
          {GRADIENT_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      </div>

      {/* Gradient Colors (shown only when gradient is enabled) */}
      {values.gradientType && values.gradientType !== "none" && (
        <div className="grid grid-cols-2 gap-4">
          {/* Gradient From */}
          <div>
            <label className={labelClass}>Gradient Von</label>
            <div className="flex gap-2">
              <select
                value={gradientFromSelectValue || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "custom") set("gradientFrom", "#000000");
                  else set("gradientFrom", v);
                }}
                className="fca-input text-xs flex-1"
              >
                <option value="">–</option>
                <option value="primary">Primärfarbe</option>
                <option value="secondary">Sekundärfarbe</option>
                <option value="black">Schwarz</option>
                <option value="white">Weiss</option>
                <option value="custom">Benutzerdefiniert</option>
              </select>
              {gradientFromIsCustom && (
                <input
                  type="color"
                  value={values.gradientFrom}
                  onChange={(e) => set("gradientFrom", e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-[var(--border)] p-0.5"
                />
              )}
            </div>
          </div>

          {/* Gradient To */}
          <div>
            <label className={labelClass}>Gradient Bis</label>
            <div className="flex gap-2">
              <select
                value={gradientToSelectValue || ""}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "custom") set("gradientTo", "#000000");
                  else set("gradientTo", v);
                }}
                className="fca-input text-xs flex-1"
              >
                <option value="">–</option>
                <option value="primary">Primärfarbe</option>
                <option value="secondary">Sekundärfarbe</option>
                <option value="black">Schwarz</option>
                <option value="white">Weiss</option>
                <option value="custom">Benutzerdefiniert</option>
              </select>
              {gradientToIsCustom && (
                <input
                  type="color"
                  value={values.gradientTo}
                  onChange={(e) => set("gradientTo", e.target.value)}
                  className="h-8 w-10 cursor-pointer rounded border border-[var(--border)] p-0.5"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Text Color */}
      <div>
        <label className={labelClass}>Textfarbe</label>
        <div className="flex gap-2">
          <select
            value={textSelectValue || "light"}
            onChange={(e) => {
              const v = e.target.value;
              if (v === "custom") set("textColor", "#ffffff");
              else set("textColor", v);
            }}
            className="fca-input text-xs flex-1"
          >
            {TEXT_COLOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {textIsCustom && (
            <input
              type="color"
              value={values.textColor || "#ffffff"}
              onChange={(e) => set("textColor", e.target.value)}
              className="h-8 w-10 cursor-pointer rounded border border-[var(--border)] p-0.5"
            />
          )}
        </div>
      </div>
    </div>
  );
}
