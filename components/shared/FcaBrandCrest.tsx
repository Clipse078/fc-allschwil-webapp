type FcaBrandCrestProps = {
  className?: string;
  variant?: "solid" | "watermark";
};

export default function FcaBrandCrest({
  className = "",
  variant = "solid",
}: FcaBrandCrestProps) {
  const isWatermark = variant === "watermark";

  return (
    <svg
      viewBox="0 0 220 260"
      aria-hidden="true"
      className={className}
      fill="none"
    >
      <path
        d="M25 20h170v92c0 62-35 104-85 128-50-24-85-66-85-128V20Z"
        fill="#0b5db3"
        opacity={isWatermark ? "0.05" : "1"}
      />
      <path
        d="M25 20h170v92c0 62-35 104-85 128-50-24-85-66-85-128V20Z"
        stroke="#cf2027"
        strokeWidth="6"
        opacity={isWatermark ? "0.06" : "1"}
      />
      <text
        x="110"
        y="58"
        textAnchor="middle"
        fontSize="28"
        fontWeight="700"
        fill={isWatermark ? "#0b5db3" : "#ffffff"}
        opacity={isWatermark ? "0.08" : "1"}
        style={{ letterSpacing: "0.04em" }}
      >
        fc allschwil
      </text>
      <text
        x="110"
        y="170"
        textAnchor="middle"
        fontSize="102"
        fontWeight="300"
        fill={isWatermark ? "#0b5db3" : "#ffffff"}
        opacity={isWatermark ? "0.05" : "1"}
        style={{ fontFamily: "Arial, Helvetica, sans-serif" }}
      >
        fca
      </text>
      <text
        x="110"
        y="218"
        textAnchor="middle"
        fontSize="24"
        fontWeight="700"
        fill={isWatermark ? "#0b5db3" : "#ffffff"}
        opacity={isWatermark ? "0.05" : "1"}
      >
        1907
      </text>
    </svg>
  );
}