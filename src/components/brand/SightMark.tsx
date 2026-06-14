/**
 * SightMark — the brand mark: two dots on an ascending diagonal. Amber dot
 * lower-left (decorative --primary), ink dot upper-right (currentColor, so it
 * inherits text color: dark on the light cream bg, off-white on dark ink).
 */
export function SightMark({ className = "", size = 22 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <circle cx="11" cy="21" r="5.2" fill="var(--primary)" />
      <circle cx="21" cy="11" r="5.2" fill="currentColor" />
    </svg>
  );
}
