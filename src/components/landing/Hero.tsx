import { Link } from "react-router-dom";
import { CertificateDemo } from "./CertificateDemo";
import { buttonClasses } from "../ui/Button";
import { ArrowRight, Check } from "../ui/Icons";

const promises = ["Free to use", "No student accounts", "Works on any phone"];

export function Hero() {
  return (
    <section id="hero" className="relative">
      <div className="container-page grid gap-12 pb-14 pt-12 sm:pb-16 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:items-center lg:gap-16 lg:pb-24 lg:pt-24">
        <div>
          <p className="eyebrow">For college departments and clubs</p>
          <h1 className="mt-4 max-w-[13ch] font-serif text-display font-semibold text-balance">
            Certificates, without the <span className="text-accent">folder full of PDFs.</span>
          </h1>
          <p className="mt-6 max-w-[34rem] text-[1.05rem] leading-relaxed text-ink-soft sm:text-lg">
            Acclaimo turns your participant list and certificate design into one private link. Students
            type their name and download their certificate, right on their phone.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to="/create" className={buttonClasses({ size: "lg" })}>
              Create your organization
              <ArrowRight className="size-4" />
            </Link>
            <a
              href="#how-it-works"
              className={buttonClasses({ variant: "secondary", size: "lg" })}
            >
              See how it works
            </a>
          </div>

          <ul className="mt-6 flex flex-wrap gap-x-5 gap-y-2">
            {promises.map((promise) => (
              <li key={promise} className="inline-flex items-center gap-1.5 text-sm text-muted">
                <Check className="size-4 text-accent" />
                {promise}
              </li>
            ))}
          </ul>
        </div>

        <div className="lg:justify-self-end">
          <CertificateDemo />
        </div>
      </div>
    </section>
  );
}
