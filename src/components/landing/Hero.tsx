import { Link } from "react-router-dom";
import { CertificateDemo } from "./CertificateDemo";
import { buttonClasses } from "../ui/Button";
import { ArrowRight, Check } from "../ui/Icons";

const promises = ["Free to use", "No student accounts", "Works on any phone"];

export function Hero() {
  return (
    <section id="hero" className="relative">
      <div className="container-page pb-16 pt-8 lg:pb-16 lg:pt-16">
        <p className="eyebrow">For college departments and clubs</p>

        <div className="mt-6 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-x-6 lg:gap-y-0">
          <div className="lg:col-span-7">
            <h1 className="font-serif text-display font-semibold text-balance">
              Certificates, without the <span className="text-accent">folder full of PDFs.</span>
            </h1>
            <p className="mt-6 max-w-[34rem] text-[1.05rem] leading-relaxed text-ink-soft sm:text-lg">
              Acclaimo turns your participant list and certificate design into one private link.
              Students type their name and download their certificate, right on their phone.
            </p>

            <div className="mt-8 flex flex-col gap-4 sm:flex-row">
              <Link to="/create" className={buttonClasses({ size: "lg" })}>
                Create your organization
                <ArrowRight className="size-4" />
              </Link>
              <a href="#how-it-works" className={buttonClasses({ variant: "secondary", size: "lg" })}>
                See how it works
              </a>
            </div>

            <ul className="mt-6 flex flex-col gap-6 sm:flex-row sm:flex-wrap sm:items-center">
              {promises.map((promise) => (
                <li key={promise} className="inline-flex items-center gap-2 text-sm text-muted">
                  <Check className="size-4 text-accent" />
                  {promise}
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-5 lg:col-start-8">
            <CertificateDemo />
          </div>
        </div>
      </div>
    </section>
  );
}
