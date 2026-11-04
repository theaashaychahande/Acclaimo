import { Link } from "react-router-dom";
import { cn } from "../../lib/cn";

export function Wordmark({ className, onClick }: { className?: string; onClick?: () => void }) {
  return (
    <Link
      to="/"
      onClick={onClick}
      aria-label="Acclaimo home"
      className={cn("group inline-flex min-h-11 items-center gap-2", className)}
    >
      <span
        aria-hidden="true"
        className="grid size-8 place-items-center rounded-[7px] bg-accent font-serif text-lg leading-none text-accent-ink before:content-['A']"
      />
      <span className="font-serif text-[1.35rem] font-semibold tracking-[-0.02em]">Acclaimo</span>
    </Link>
  );
}
