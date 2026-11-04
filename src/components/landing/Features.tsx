import { Link } from "react-router-dom";
import { CertificateCard } from "../ui/CertificateCard";
import { ArrowRight } from "../ui/Icons";

const features = [
  {
    title: "The certificate is made on the student's phone",
    body: "No server renders the PDF, so there is nothing to queue, no folder to fill, and nothing to clean up afterwards.",
  },
  {
    title: "The database keeps hashes, not names",
    body: "Each name is turned into a one-way code before it leaves the browser. A stolen table would not read as a list of students.",
  },
  {
    title: "Winners and positions print themselves",
    body: "If your sheet says Winner, 1st Runner Up, or Volunteer, that value is placed on the certificate automatically.",
  },
  {
    title: "A different design for each category",
    body: "Give participants, winners, and runners-up their own template. Up to six categories per event.",
  },
  {
    title: "English and Devanagari names",
    body: "Names in either script render correctly, including the combining marks that often break in certificate tools.",
  },
  {
    title: "Pause, extend, or close the link",
    body: "Distribution rarely goes exactly to plan. Change the expiry date or pause the link without rebuilding anything.",
  },
  {
    title: "Nothing for students to install",
    body: "No app, no account, no email. The link opens in a phone browser, including the one inside WhatsApp.",
  },
];

const sampleCategories = [
  { label: "Participant", category: "participant" as const, position: undefined },
  { label: "Winner", category: "winner" as const, position: "Winner" },
  { label: "1st Runner Up", category: "runner" as const, position: "1st Runner Up" },
];

export function Features() {
  return (
    <section className="py-16 sm:py-20" aria-labelledby="features-heading">
      <div className="container-page">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div className="lg:sticky lg:top-24 lg:self-start">
            <p className="eyebrow">What makes it different</p>
            <h2 id="features-heading" className="mt-3 font-serif text-title font-semibold text-balance">
              Made for the way departments actually work.
            </h2>
            <p className="mt-4 max-w-md text-[1.02rem] leading-relaxed text-muted">
              Most certificate tools ask for money, an account, or a week of manual work. Acclaimo
              asks for a spreadsheet, a design, and one link.
            </p>
            <Link
              to="/#how-it-works"
              className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-accent underline-offset-4 hover:underline"
            >
              Walk through the setup
              <ArrowRight className="size-4" />
            </Link>
          </div>

          <ol>
            {features.map((feature, index) => (
              <li
                key={feature.title}
                className="grid grid-cols-[2.1rem_1fr] gap-3 border-t border-line py-5 last:border-b"
              >
                <span className="pt-0.5 font-serif text-sm tabular-nums text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="font-semibold leading-snug">{feature.title}</h3>
                  <p className="mt-1.5 max-w-xl text-sm leading-relaxed text-muted">{feature.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>

        <div className="mt-16 grid gap-10 border-t border-line pt-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <p className="eyebrow">One list, several designs</p>
            <h3 className="mt-3 font-serif text-subtitle font-semibold">
              Everyone gets the right certificate.
            </h3>
            <p className="mt-3 max-w-lg text-[0.98rem] leading-relaxed text-muted">
              Add a Category column to the sheet and map each value to a design. A winner receives
              the winner design with their position printed. A participant receives the plain one.
              Blank categories fall back to your default.
            </p>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
              No second upload. No sorting files into folders by hand.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {sampleCategories.map((sample) => (
              <figure key={sample.label}>
                <CertificateCard
                  name="Aarohi D."
                  event="MECHMERISE 2026"
                  position={sample.position}
                  category={sample.category}
                />
                <figcaption className="mt-2 text-xs text-muted">{sample.label}</figcaption>
              </figure>
            ))}
          </div>
        </div>

        <div className="mt-16 grid gap-10 border-t border-line pt-12 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div className="lg:order-2">
            <p className="eyebrow">Design once</p>
            <h3 className="mt-3 font-serif text-subtitle font-semibold">
              Place the words. Not the pixels.
            </h3>
            <p className="mt-3 max-w-lg text-[0.98rem] leading-relaxed text-muted">
              Drop the name box where it belongs and set the font, size, colour, and alignment. Add
              a second box for position text if your event has it. Both scale with the template, so
              one design works at any size.
            </p>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-muted">
              Long names shrink and wrap instead of spilling out of the box.
            </p>
          </div>

          <div aria-hidden="true" className="rounded-[8px] border border-line bg-surface p-3 sm:p-4">
            <div className="flex items-center justify-between border-b border-line pb-2 text-[0.6rem] uppercase tracking-[0.1em] text-muted">
              <span>Designer</span>
              <span>Winner category</span>
            </div>
            <div className="mt-3 grid grid-cols-[1fr_auto] gap-3">
              <div className="relative aspect-[1.414/1] overflow-hidden rounded-[4px] border border-line bg-[#fcf8ed]">
                <div className="absolute inset-2 border border-[#0d5c50]/20" />
                <p className="absolute inset-x-0 top-[17%] text-center font-serif text-[0.62rem] text-[#1b2923]">
                  Certificate of Achievement
                </p>
                <div className="absolute left-[25%] top-[40%] w-[50%] rounded-[2px] border border-dashed border-[#0d5c50] bg-[#e2efe9]/90 px-1 py-1.5 text-center text-[0.55rem] font-medium text-[#0d5c50]">
                  Aarohi Deshmukh
                </div>
                <div className="absolute left-[33%] top-[58%] w-[34%] rounded-[2px] border border-dashed border-[#8a6524] bg-[#f3ead7] px-1 py-0.5 text-center text-[0.5rem] text-[#7a571c]">
                  1st Runner Up
                </div>
              </div>
              <div className="hidden w-24 flex-col gap-2 sm:flex">
                {[
                  ["Font", "Source Serif"],
                  ["Size", "42 pt"],
                  ["Align", "Center"],
                  ["Case", "As typed"],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[3px] border border-line bg-paper px-2 py-1.5">
                    <p className="text-[0.48rem] uppercase tracking-[0.08em] text-muted">{label}</p>
                    <p className="mt-0.5 text-[0.55rem] text-ink-soft">{value}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
