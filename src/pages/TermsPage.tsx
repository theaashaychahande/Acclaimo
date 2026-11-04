import { PageIntro } from "../components/layout/PageIntro";

export function TermsPage() {
  return (
    <PageIntro
      eyebrow="Terms"
      title="A few rules for using Acclaimo."
      intro="Short and readable. Using the site means you agree to the points below."
    >
      <article className="max-w-3xl">
        <p className="text-xs uppercase tracking-[0.14em] text-muted">Last updated 5 November 2026</p>

        <div className="mt-8 space-y-8">
          <section className="border-t border-line pt-6">
            <h2 className="font-serif text-2xl font-semibold">The service</h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-muted">
              Acclaimo is a free tool for distributing event certificates. It is provided as-is,
              without a guarantee of uninterrupted availability. The project runs on free hosting and
              may need maintenance from time to time.
            </p>
          </section>

          <section className="border-t border-line pt-6">
            <h2 className="font-serif text-2xl font-semibold">Organizer responsibility</h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-muted">
              If you upload a participant list, you confirm that you have permission to use it for
              this purpose. You are responsible for the accuracy of the names, categories, and
              position text in your spreadsheet, and for the certificates your organization issues.
            </p>
          </section>

          <section className="border-t border-line pt-6">
            <h2 className="font-serif text-2xl font-semibold">Certificates are not verification</h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-muted">
              Acclaimo distributes certificates. It does not prove identity, attendance, or
              achievement. Anyone who knows a participant&rsquo;s name may be able to download that
              certificate. Do not present an Acclaimo certificate as independently verified.
            </p>
          </section>

          <section className="border-t border-line pt-6">
            <h2 className="font-serif text-2xl font-semibold">Acceptable use</h2>
            <ul className="mt-4 space-y-2 text-[0.98rem] leading-relaxed text-muted">
              <li>Do not create organizations or events for spam, harassment, or fraud.</li>
              <li>Do not upload content you do not have the right to use.</li>
              <li>Do not attempt to read another organization&rsquo;s data or break rate limits.</li>
              <li>Inappropriate templates or abusive activity can be disabled without notice.</li>
            </ul>
          </section>

          <section className="border-t border-line pt-6">
            <h2 className="font-serif text-2xl font-semibold">Changes</h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-muted">
              These terms may change as the product grows. The date at the top of this page will be
              updated when they do.
            </p>
          </section>

          <section className="border-t border-line pt-6">
            <h2 className="font-serif text-2xl font-semibold">Contact</h2>
            <p className="mt-4 text-[0.98rem] leading-relaxed text-muted">
              Questions about these terms can go to the{" "}
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
