import { Link } from "react-router-dom";
import { buttonClasses } from "../ui/Button";
import { ArrowRight } from "../ui/Icons";

export function FinalCta() {
  return (
    <section id="final-cta" className="pb-16 sm:pb-20">
      <div className="container-page">
        <div className="rounded-[10px] bg-accent px-6 py-12 text-accent-ink sm:px-12 sm:py-14">
          <p className="text-[0.7rem] font-semibold uppercase tracking-[0.18em] opacity-75">
            Your next event
          </p>
          <h2 className="mt-4 max-w-2xl font-serif text-[clamp(1.9rem,4vw,3rem)] font-semibold leading-[1.08] tracking-[-0.025em] text-balance">
            It doesn&rsquo;t need a certificate folder.
          </h2>
          <p className="mt-4 max-w-xl text-[1.02rem] leading-relaxed opacity-85">
            Set up the list and design once, share one link, and let students pick up their own
            certificate.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link to="/create" className={buttonClasses({ variant: "inverse", size: "lg" })}>
              Create your organization
              <ArrowRight className="size-4" />
            </Link>
            <Link
              to="/help"
              className="inline-flex min-h-11 items-center justify-center px-2 text-sm font-medium underline-offset-4 hover:underline"
            >
              Read the help page
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
