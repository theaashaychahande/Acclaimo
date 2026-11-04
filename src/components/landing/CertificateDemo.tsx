import { useEffect, useState } from "react";
import { Button } from "../ui/Button";
import { CertificateCard } from "../ui/CertificateCard";
import { Download, Phone } from "../ui/Icons";

const fullName = "Aarohi Deshmukh";

export function CertificateDemo() {
  const [reduced, setReduced] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  );
  const [typed, setTyped] = useState(reduced ? fullName : "");
  const [revealed, setRevealed] = useState(reduced);
  const [note, setNote] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (reduced) {
      setTyped(fullName);
      setRevealed(true);
      return;
    }

    const timers: number[] = [];
    const startDelay = 700;
    const perCharacter = 62;

    function run() {
      setTyped("");
      setRevealed(false);
      setNote(false);

      for (let index = 1; index <= fullName.length; index += 1) {
        timers.push(
          window.setTimeout(() => setTyped(fullName.slice(0, index)), startDelay + index * perCharacter),
        );
      }

      const typedAt = startDelay + fullName.length * perCharacter;
      timers.push(window.setTimeout(() => setRevealed(true), typedAt + 320));
      timers.push(window.setTimeout(run, typedAt + 7000));
    }

    run();
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [reduced]);

  return (
    <div className="mx-auto w-full max-w-[30rem]">
      <div className="rounded-[10px] border border-line bg-surface p-4 sm:p-5">
        <div className="flex items-center justify-between border-b border-line pb-3">
          <p className="text-[0.68rem] font-semibold uppercase tracking-[0.16em] text-muted">
            Student view
          </p>
          <p className="inline-flex items-center gap-1.5 text-[0.68rem] font-medium uppercase tracking-[0.12em] text-accent">
            <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
            Live preview
          </p>
        </div>

        <div className="mt-4">
          <p className="text-xs font-medium text-ink-soft">Your full name</p>
          <div className="mt-1.5 flex min-h-12 items-center justify-between gap-3 rounded-md border border-line-strong bg-paper px-3.5">
            <p className="truncate text-[0.95rem]">
              {typed}
              {!reduced ? (
                <span className="demo-caret ml-px inline-block h-[1.05em] w-px translate-y-[0.15em] bg-accent" />
              ) : null}
            </p>
            <Phone className="size-4 shrink-0 text-muted" />
          </div>
        </div>

        <div className="mt-4">
          {revealed ? (
            <div className="demo-certificate">
              <CertificateCard
                name={fullName}
                event="MECHMERISE 2026"
                position="Winner"
                category="winner"
              />
            </div>
          ) : (
            <div className="skeleton aspect-[1.414/1] w-full rounded-[5px]" aria-hidden="true" />
          )}
        </div>

        <Button full className="mt-4" onClick={() => setNote(true)} disabled={!revealed}>
          <Download className="size-4" />
          Download PDF
        </Button>

        <p className="mt-2 min-h-4 text-center text-xs text-muted" aria-live="polite">
          {note
            ? "Preview only. Downloads work once your event is live."
            : revealed
              ? "Aarohi's certificate is ready."
              : "Looking up your name…"}
        </p>
      </div>

      <p className="mt-3 text-center text-xs leading-relaxed text-muted">
        The certificate is drawn on the student&rsquo;s phone, not on a server.
      </p>
    </div>
  );
}
