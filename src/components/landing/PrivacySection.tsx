import { Link } from "react-router-dom";
import { ArrowRight, Check, Close, Shield } from "../ui/Icons";

const stored = [
  "A hash of each participant name",
  "Category and position text",
  "Certificate templates and layout",
  "Counts of searches and downloads",
];

const notStored = [
  "Plain student names",
  "Emails or phone numbers",
  "Student accounts or passwords",
  "Advertising or browsing trackers",
];

export function PrivacySection() {
  return (
    <section id="privacy" className="border-y border-line bg-surface py-16 lg:py-24">
      <div className="container-page grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div>
          <p className="eyebrow">Privacy</p>
          <h2 className="mt-4 font-serif text-title font-semibold text-balance">
            A list of hashes is not a list of students.
          </h2>
          <p className="mt-12 max-w-md text-[1.02rem] leading-relaxed text-muted">
            Names are normalized and hashed inside the browser. The database receives the result,
            never the name itself. There is no public participant list, and one organization cannot
            read another&rsquo;s data.
          </p>
          <Link
            to="/privacy"
            className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent underline-offset-4 hover:underline"
          >
            Read the privacy note
            <ArrowRight className="size-4" />
          </Link>
        </div>

        <div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[8px] border border-line bg-paper p-6">
              <div className="flex items-center gap-2">
                <Shield className="size-[18px] text-accent" />
                <h3 className="text-sm font-semibold">What we keep</h3>
              </div>
              <ul className="mt-4 space-y-2">
                {stored.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-snug text-ink-soft">
                    <Check className="size-4 shrink-0 translate-y-0.5 text-accent" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-[8px] border border-line bg-paper p-6">
              <div className="flex items-center gap-2">
                <Close className="size-[18px] text-muted" />
                <h3 className="text-sm font-semibold">What we never keep</h3>
              </div>
              <ul className="mt-4 space-y-2">
                {notStored.map((item) => (
                  <li key={item} className="flex gap-2 text-sm leading-snug text-ink-soft">
                    <Close className="size-4 shrink-0 translate-y-0.5 text-muted" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="mt-6 border-l-2 border-accent pl-4 text-sm leading-relaxed text-muted">
            Hashing protects the database, not the certificate. Anyone who knows a student&rsquo;s
            name can look up that certificate. Acclaimo is a distribution tool, not an identity
            check.
          </p>
        </div>
      </div>
    </section>
  );
}
