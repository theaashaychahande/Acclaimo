import { PageIntro } from "../components/layout/PageIntro";

export function PrivacyPage() {
  return (
    <PageIntro
      eyebrow="Privacy"
      title="What Acclaimo stores, and what it doesn't."
      intro="Written in plain language. This page describes the first version of the product."
    >
      <article className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">Last updated 5 November 2026</p>

        <div className="mt-8 space-y-8">
          <section className="border-t border-line pt-6">
            <h2 className="font-serif text-2xl font-semibold">The short version</h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-muted">
              Student names are normalized and hashed in the browser before anything is uploaded.
              The database stores those hashes, not a readable list of names. Category labels and
              position text stay readable because they are part of the certificate, not personal
              identity. There are no student accounts, no emails, no phone numbers, and no
              advertising trackers.
            </p>
          </section>

          <section className="border-t border-line pt-6">
            <h2 className="font-serif text-2xl font-semibold">What is stored</h2>
            <ul className="mt-4 space-y-2 text-[0.98rem] leading-relaxed text-muted">
              <li>Organization name, department or club, and an optional public contact.</li>
              <li>A hash of the organizer&rsquo;s edit key. The plain key is never stored.</li>
              <li>Event details, certificate templates, and design settings.</li>
              <li>Participant name hashes, plus category and position text.</li>
              <li>Counts of searches, downloads, and unsuccessful lookups.</li>
            </ul>
          </section>

          <section className="border-t border-line pt-6">
            <h2 className="font-serif text-2xl font-semibold">What is not stored</h2>
            <ul className="mt-4 space-y-2 text-[0.98rem] leading-relaxed text-muted">
              <li>Plain student names.</li>
              <li>Student emails, phone numbers, or passwords.</li>
              <li>Student accounts or profiles.</li>
              <li>Advertising identifiers, tracking cookies, or third-party analytics scripts.</li>
            </ul>
          </section>

          <section className="border-t border-line pt-6">
            <h2 className="font-serif text-2xl font-semibold">Who can see what</h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-muted">
              An organizer can only reach their own organization. One organization cannot read
              another&rsquo;s events, participants, or templates. The platform admin can see
              organization names and counts, never participant data. The public cannot read the
              database directly; the student page asks a narrow, rate-limited lookup.
            </p>
          </section>

          <section className="border-t border-line pt-6">
            <h2 className="font-serif text-2xl font-semibold">Deletion and expiry</h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-muted">
              Organizers can clear a participant list or delete an event. The platform admin can
              disable or delete an organization. Deleting removes the related hashes, categories,
              and templates. Events stop working on the expiry date the organizer chooses, and the
              retention job removes them after 90 days.
            </p>
          </section>

          <section className="border-t border-line pt-6">
            <h2 className="font-serif text-2xl font-semibold">An honest limitation</h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-muted">
              Hashing protects a database if it is leaked. It does not make a name secret. Someone
              who knows a student&rsquo;s name can still look up that certificate. Acclaimo is a
              distribution tool, not an identity or attendance verification service.
            </p>
          </section>

          <section className="border-t border-line pt-6">
            <h2 className="font-serif text-2xl font-semibold">Questions</h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-muted">
              Open an issue on the{" "}
              <a
                href="https://github.com/theaashaychahande/Acclaimo/issues"
                target="_blank"
                rel="noreferrer"
                className="text-accent underline underline-offset-4"
              >
                project repository
              </a>
              .
            </p>
          </section>
        </div>
      </article>
    </PageIntro>
  );
}
