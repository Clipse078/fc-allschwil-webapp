type SportClubEvoMarkProps = {
  className?: string;
  variant?: "default" | "watermark";
};

export default function SportClubEvoMark({
  className = "",
  variant = "default",
}: SportClubEvoMarkProps) {
  const isWatermark = variant === "watermark";

  return (
    <svg
      viewBox="0 0 240 240"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <circle
        cx="120"
        cy="120"
        r="108"
        fill={isWatermark ? "rgba(34,197,94,0.04)" : "#0f172a"}
        stroke={isWatermark ? "rgba(34,197,94,0.06)" : "#22c55e"}
        strokeWidth="6"
      />
      <circle
        cx="120"
        cy="120"
        r="88"
        stroke={isWatermark ? "rgba(34,197,94,0.05)" : "rgba(34,197,94,0.25)"}
        strokeWidth="1.5"
        strokeDasharray="4 4"
      />
      <text
        x="120"
        y="106"
        textAnchor="middle"
        fontSize="28"
        fontWeight="800"
        fill={isWatermark ? "rgba(34,197,94,0.08)" : "#22c55e"}
        style={{ letterSpacing: "-0.02em", fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        SCE
      </text>
      <text
        x="120"
        y="134"
        textAnchor="middle"
        fontSize="11"
        fontWeight="600"
        fill={isWatermark ? "rgba(148,163,184,0.07)" : "rgba(148,163,184,0.7)"}
        style={{ letterSpacing: "0.18em", fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        PLATFORM
      </text>
    </svg>
  );
}
