interface AuraLogoProps {
  className?: string;
  showTagline?: boolean;
  variant?: "horizontal" | "stacked" | "mark";
}

export function AuraLogo({
  className = "",
  showTagline = true,
  variant = "horizontal",
}: AuraLogoProps) {
  const Mark = (
    <svg
      viewBox="0 0 48 48"
      className="aspect-square h-full w-auto shrink-0"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <circle cx="24" cy="24" r="22" strokeWidth="0.6" opacity="0.18" />
      <circle cx="24" cy="24" r="16" strokeWidth="0.7" opacity="0.35" />
      <circle cx="24" cy="24" r="10" strokeWidth="0.8" opacity="0.6" />
      <circle cx="24" cy="24" r="5" strokeWidth="0.9" opacity="0.85" />
      <circle cx="24" cy="24" r="1.8" fill="currentColor" stroke="none" />
      {[0, 1.2, 2.4].map((delay, i) => (
        <circle
          key={i}
          cx="24"
          cy="24"
          r="2"
          fill="none"
          stroke="currentColor"
          opacity="0"
        >
          <animate
            attributeName="r"
            values="2;23"
            dur="3.6s"
            begin={`${delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0;0.85;0"
            keyTimes="0;0.2;1"
            dur="3.6s"
            begin={`${delay}s`}
            repeatCount="indefinite"
          />
          <animate
            attributeName="stroke-width"
            values="1.6;0.2"
            dur="3.6s"
            begin={`${delay}s`}
            repeatCount="indefinite"
          />
        </circle>
      ))}
    </svg>
  );

  if (variant === "mark") {
    return (
      <span className={`inline-flex ${className}`} data-testid="logo-mark">
        {Mark}
      </span>
    );
  }

  if (variant === "stacked") {
    return (
      <span
        className={`inline-flex flex-col items-center gap-2 ${className}`}
        data-testid="logo-aura"
      >
        <span className="h-10 w-10">{Mark}</span>
        <span className="flex flex-col items-center leading-none">
          <span className="font-display tracking-[0.42em] text-[1.4em] font-normal">
            AURA
          </span>
          {showTagline && (
            <span className="mt-1.5 font-sans tracking-[0.45em] text-[0.5em] uppercase opacity-55">
              Peptides
            </span>
          )}
        </span>
      </span>
    );
  }

  return (
    <span
      className={`inline-flex items-center gap-2.5 leading-none ${className}`}
      data-testid="logo-aura"
    >
      <span className="h-full">{Mark}</span>
      <span className="flex flex-col leading-none">
        <span className="font-display tracking-[0.32em] text-[1.05em] font-normal">
          AURA
        </span>
        {showTagline && (
          <span className="mt-1 font-sans tracking-[0.36em] text-[0.46em] uppercase opacity-55">
            Peptides
          </span>
        )}
      </span>
    </span>
  );
}
