import { Plus } from "../ui/Icons";

const questions = [
  {
    question: "I lost my edit key. What now?",
    answer:
      "The key is shown once at sign-up. Contact the platform admin with your organization name and a way to confirm you run it, and they can issue a new key. There is no self-service reset in the first version.",
  },
  {
    question: "A student cannot find their name.",
    answer:
      "Ask them to use the full name from the registration form. Extra spaces, capitals, punctuation, and reversed first and last names are handled. Initials and nicknames are not. If the list itself is wrong, the organizer can replace it.",
  },
  {
    question: "The download does not start inside WhatsApp.",
    answer:
      "WhatsApp's in-app browser sometimes blocks file downloads. Tap the menu in the top corner, choose Open in browser, and try the download again. The result page also shows this fallback.",
  },
  {
    question: "Two students have the same name.",
    answer:
      "When a name appears twice in one event, the sheet needs an Identifier column, such as a roll number. The student is asked for that identifier before the certificate is shown.",
  },
  {
    question: "The wrong position is printed.",
    answer:
      "Check the Position column in the spreadsheet and the position box on the design. Correct the sheet or the design, then replace the list. The next download uses the new value.",
  },
  {
    question: "Can I delete a list, an event, or the whole organization?",
    answer:
      "Yes. Organizers can delete their data at any time. Deleting removes the participant hashes, categories, and templates. Expired events are cleaned up automatically after 90 days.",
  },
  {
    question: "What does Acclaimo cost?",
    answer:
      "Nothing. It runs on free hosting and a small backend, with no ads and no paid plan. The project is built to stay inside those limits.",
  },
  {
    question: "Does Acclaimo prove a certificate is genuine?",
    answer:
      "No. It distributes certificates; it does not verify identity. Someone who knows a student's name can look up that certificate. Treat the link as private, not as proof of attendance.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="py-16 sm:py-20">
      <div className="container-page grid gap-10 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
        <div>
          <p className="eyebrow">Questions</p>
          <h2 className="mt-3 font-serif text-title font-semibold">Before you share the link.</h2>
          <p className="mt-4 max-w-sm text-[0.98rem] leading-relaxed text-muted">
            The short answers to the things organizers and students ask most often.
          </p>
        </div>

        <div>
          {questions.map((item) => (
            <details key={item.question} className="group border-t border-line py-4 last:border-b">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 [&::-webkit-details-marker]:hidden">
                <span className="text-[0.98rem] font-medium">{item.question}</span>
                <Plus className="size-4 shrink-0 text-muted transition-transform duration-200 group-open:rotate-45" />
              </summary>
              <p className="mt-3 max-w-2xl pr-8 text-sm leading-relaxed text-muted">{item.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
