export function Chip({
  value,
  className = "",
}: {
  value: number;
  className?: string;
}) {
  return (
    <span className={`chip chip-${value} ${className}`}>
      <svg viewBox="0 0 64 64" aria-hidden="true">
        <circle cx="32" cy="32" r="29" fill="currentColor" />
        <circle
          cx="32"
          cy="32"
          r="27"
          fill="none"
          stroke="var(--chip-edge)"
          strokeWidth="4"
          strokeDasharray="9 11"
        />
        <circle
          cx="32"
          cy="32"
          r="21"
          fill="none"
          stroke="var(--chip-edge)"
          strokeWidth="1"
          opacity=".6"
        />
      </svg>
      <span>{value >= 1000 ? `${value / 1000}k` : value}</span>
    </span>
  );
}
