import { Link } from "react-router-dom";
import { PageIntro } from "../components/layout/PageIntro";
import { ArrowRight } from "../components/ui/Icons";

const guides = [
  {
    title: "Understand the design",
    points: [
      "Certificates currently use Acclaimo's built-in layout.",
      "Template upload and the position designer are the next piece of work.",
      "When it ships, use an A4 landscape image at least 1754 × 1240 pixels.",
      "Keep fixed words such as “has secured” in the image itself.",
    ],
  },
  {
    title: "Add your participants",
    points: [
      "Open an event and paste one name per line.",
      "Add a comma and the position text to print it, for example Aashay Chahande, Winner.",
      "Names are hashed in the browser before they reach the server.",
      "Spreadsheet import is coming next; the paste box is the current path.",
    ],
  },
  {
    title: "Share the link",
    points: [
      "Publish the event and copy your student link from the dashboard.",
      "Send it to the WhatsApp group, or use the share button.",
      "Students type their name and download the certificate on their own device.",
      "Pause or change the expiry date from the dashboard at any time.",
    ],
  },
];

export function HelpPage() {
  return (
    <PageIntro
      eyebrow="Help"
      title="Everything you need before the first upload."
      intro="A short guide for organizers. The full help centre will grow as the product does."
    >
      <div className="grid gap-8 md:grid-cols-3">
        {guides.map((guide, index) => (
          <section key={guide.title} className="border-t border-line pt-6">
            <p className="font-serif text-lg text-accent">{String(index + 1).padStart(2, "0")}</p>
            <h2 className="mt-2 text-[1.02rem] font-semibold">{guide.title}</h2>
            <ul className="mt-4 space-y-2">
              {guide.points.map((point) => (
                <li key={point} className="flex gap-2 text-sm leading-relaxed text-muted">
                  <span className="mt-2 size-1 shrink-0 rounded-full bg-line-strong" aria-hidden="true" />
                  {point}
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-12 rounded-[8px] border border-line bg-surface p-6 sm:flex sm:items-center sm:justify-between">
        <div>
          <h2 className="font-serif text-xl font-semibold">Still stuck?</h2>
          <p className="mt-2 text-sm text-muted">
            Open an issue on GitHub and describe what you were trying to do.
          </p>
        </div>
        <a
          href="https://github.com/theaashaychahande/Acclaimo/issues"
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent underline-offset-4 hover:underline sm:mt-0"
        >
          Go to issues
          <ArrowRight className="size-4" />
        </a>
      </div>

      <p className="mt-6 text-sm text-muted">
        Looking for quick answers? Read the{" "}
        <Link to="/#faq" className="text-accent underline underline-offset-4">
          common questions
        </Link>
        .
      </p>
    </PageIntro>
  );
}
