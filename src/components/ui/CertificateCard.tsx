import type { CSSProperties } from "react";
import { cn } from "../../lib/cn";

type CertificateCardProps = {
  name: string;
  event?: string;
  position?: string;
  category?: "participant" | "winner" | "runner";
  className?: string;
};

const accents = {
  participant: "#0d5c50",
  winner: "#8a6524",
  runner: "#41546b",
} as const;

export function CertificateCard({
  name,
  event = "MECHMERISE 2026",
  position,
  category = "participant",
  className,
}: CertificateCardProps) {
  const accent = accents[category];
  const label = position
    ? `Sample certificate for ${name}, ${position}, ${event}`
    : `Sample certificate for ${name}, ${event}`;

  return (
    <div
      role="img"
      aria-label={label}
      style={{ "--cert-accent": accent } as CSSProperties}
      className={cn(
        "@container relative aspect-[1.414/1] w-full overflow-hidden rounded-[5px] bg-[#fcf8ed] text-[#1b2923]",
        className,
      )}
    >
      <div className="absolute inset-[2.8%] rounded-[2px] border [border-color:var(--cert-accent)] opacity-55" />
      <div className="absolute inset-[3.9%] rounded-[1px] border [border-color:var(--cert-accent)] opacity-25" />

      <div className="relative flex h-full flex-col items-center justify-center px-[10%] pb-[9%] pt-[6%] text-center">
        <p className="text-[1.75cqw] font-semibold uppercase tracking-[0.38em] [color:var(--cert-accent)]">
          Certificate
        </p>
        <p className="mt-[0.8cqw] font-serif text-[4.6cqw] leading-none font-medium tracking-tight">
          of achievement
        </p>
        <div className="mt-[2.2cqw] h-px w-[16%] [background-color:var(--cert-accent)] opacity-40" />

        <p className="mt-[2.6cqw] text-[1.55cqw] uppercase tracking-[0.2em] text-[#67716a]">
          This certificate is presented to
        </p>
        <p className="mt-[1.2cqw] max-w-full font-serif text-[7.1cqw] leading-[1.05] font-semibold tracking-tight [overflow-wrap:anywhere]">
          {name}
        </p>
        <p className="mt-[1.6cqw] text-[1.55cqw] uppercase tracking-[0.18em] text-[#67716a]">
          for participation in
        </p>
        <p className="mt-[0.5cqw] font-serif text-[3.1cqw] leading-tight font-medium">{event}</p>

        {position ? (
          <p className="mt-[2cqw] border-y px-[3%] py-[0.9cqw] text-[2cqw] font-semibold uppercase tracking-[0.24em] [border-color:var(--cert-accent)] [color:var(--cert-accent)]">
            {position}
          </p>
        ) : null}
      </div>

      <div className="absolute inset-x-[8%] bottom-[6.5%] flex items-end justify-between">
        <div className="w-[21%] text-center">
          <div className="border-t border-[#1b2923]/35 pt-[1cqw] text-[1.25cqw] tracking-wide text-[#5d675f]">
            Event coordinator
          </div>
        </div>

        <div className="grid size-[8.4cqw] place-items-center rounded-full border-2 [border-color:var(--cert-accent)]">
          <div className="grid size-[6.6cqw] place-items-center rounded-full border [border-color:var(--cert-accent)] text-center">
            <span className="font-serif text-[2.5cqw] font-semibold leading-none [color:var(--cert-accent)]">
              A
            </span>
            <span className="text-[0.85cqw] uppercase tracking-[0.14em] text-[#4f5a53]">2026</span>
          </div>
        </div>

        <div className="w-[21%] text-center">
          <div className="border-t border-[#1b2923]/35 pt-[1cqw] text-[1.25cqw] tracking-wide text-[#5d675f]">
            04 November 2026
          </div>
        </div>
      </div>
    </div>
  );
}
