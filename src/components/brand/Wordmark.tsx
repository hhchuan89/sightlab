/**
 * M00 wordmark — three treatments (PLAN §4.4):
 *  A) default      — "Sight Lab" serif + amber period.
 *  B) masthead     — A + a mono 9px "Market Intelligence" sub-label.
 *  C) tight/nav     — "M" + amber "00" mono, for compact nav / mobile.
 */

type Variant = "A" | "B" | "C";

export function Wordmark({
  variant = "A",
  className = "",
}: {
  variant?: Variant;
  className?: string;
}) {
  if (variant === "C") {
    return (
      <span
        className={`font-mono text-lg font-semibold tracking-tight text-text ${className}`}
        aria-label="SightLab"
      >
        M<span className="text-primary">00</span>
      </span>
    );
  }

  const lockup = (
    <span className="font-serif text-2xl font-semibold leading-none tracking-tight text-text">
      Sight<span className="font-normal">Lab</span>
      <span className="text-primary">.</span>
    </span>
  );

  if (variant === "B") {
    return (
      <span
        className={`inline-flex flex-col gap-1 ${className}`}
        aria-label="SightLab — Market Intelligence"
      >
        {lockup}
        <span className="label-mono text-[9px] text-muted">Market Intelligence</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-baseline ${className}`} aria-label="SightLab">
      {lockup}
    </span>
  );
}
