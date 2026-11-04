import type { ReactNode } from "react";
import { CertificateCard } from "../ui/CertificateCard";
import { CursorBox, Download, LinkIcon, Phone, Spreadsheet } from "../ui/Icons";

function MiniPanel({ children }: { children: ReactNode }) {
  return (
    <div aria-hidden="true" className="mt-5 rounded-[6px] border border-line bg-surface p-3">
      {children}
    </div>
  );
}

function SheetPreview() {
  return (
    <>
      <div className="overflow-hidden rounded-[4px] border border-line">
        <div className="grid grid-cols-[1.4fr_1fr_0.9fr] bg-surface-muted px-2 py-1.5 text-[0.55rem] uppercase tracking-[0.08em] text-muted">
          <span>Name</span>
          <span>Category</span>
          <span>Position</span>
        </div>
        {[
          ["Aarohi D.", "Winner", "1st"],
          ["Rohan I.", "Participant", "—"],
          ["Sana K.", "Runner up", "2nd"],
        ].map(([name, category, position]) => (
          <div
            key={name}
            className="grid grid-cols-[1.4fr_1fr_0.9fr] border-t border-line/70 px-2 py-1.5 text-[0.6rem] text-ink-soft"
          >
            <span className="truncate">{name}</span>
            <span className="truncate">{category}</span>
            <span className="truncate text-muted">{position}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[0.55rem] text-muted">
        <span className="rounded-[3px] border border-line bg-paper px-1.5 py-0.5">
          participants.xlsx
        </span>
        <span className="rounded-[3px] border border-line bg-paper px-1.5 py-0.5">
          certificate.png
        </span>
      </div>
    </>
  );
}

function DesignerPreview() {
  return (
    <>
      <div className="relative aspect-[1.414/1] overflow-hidden rounded-[4px] border border-line bg-[#fcf8ed]">
        <div className="absolute inset-2 border border-[#0d5c50]/20" />
        <div className="absolute left-[27%] top-[36%] w-[46%] rounded-[2px] border border-dashed border-[#0d5c50] bg-[#e2efe9]/90 px-1 py-1.5 text-center text-[0.52rem] font-medium text-[#0d5c50]">
          Name
        </div>
        <div className="absolute left-[34%] top-[54%] w-[32%] rounded-[2px] border border-dashed border-[#8a6524] bg-[#f3ead7] px-1 py-0.5 text-center text-[0.48rem] text-[#7a571c]">
          Winner
        </div>
        <p className="absolute inset-x-0 bottom-[16%] text-center font-serif text-[0.62rem] text-[#1b2923]">
          MECHMERISE 2026
        </p>
      </div>
      <p className="mt-2 text-[0.6rem] leading-snug text-muted">
        Drag the box, choose the font, preview a real name.
      </p>
    </>
  );
}

function SharePreview() {
  return (
    <>
      <p className="text-[0.55rem] uppercase tracking-[0.1em] text-muted">Student link</p>
      <div className="mt-1.5 flex items-center gap-1.5 rounded-[4px] border border-line-strong bg-paper px-2 py-2">
        <LinkIcon className="size-3 shrink-0 text-accent" />
        <span className="truncate text-[0.6rem] text-ink-soft">acclaimo.app/o/7f3k9q</span>
        <span className="ml-auto shrink-0 text-[0.55rem] font-semibold text-accent">Copy</span>
      </div>
      <div className="mt-2 rounded-[4px] bg-accent-soft px-2 py-2 text-[0.58rem] leading-snug text-ink-soft">
        Certificates for MECHMERISE 2026 are ready. Open the link and type your name.
      </div>
    </>
  );
}

function StudentInputPreview() {
  return (
    <div className="rounded-[4px] border border-line bg-paper p-2.5">
      <p className="text-[0.55rem] font-medium text-ink-soft">Your full name</p>
      <div className="mt-1 flex items-center rounded-[3px] border border-line-strong bg-surface px-2 py-1.5 text-[0.62rem]">
        Aarohi Deshmukh
      </div>
      <div className="mt-1.5 rounded-[3px] bg-accent px-2 py-1.5 text-center text-[0.6rem] font-medium text-accent-ink">
        Find my certificate
      </div>
    </div>
  );
}

function StudentDownloadPreview() {
  return (
    <div className="rounded-[4px] border border-line bg-paper p-2.5">
      <div className="flex items-center gap-2.5">
        <div className="w-16 shrink-0">
          <CertificateCard
            name="Aarohi D."
            event="MECHMERISE 26"
            position="Winner"
            category="winner"
          />
        </div>
        <div className="min-w-0">
          <p className="truncate text-[0.62rem] font-medium">Your certificate</p>
          <p className="mt-0.5 text-[0.55rem] text-muted">PDF · ready to download</p>
          <div className="mt-1.5 inline-flex items-center gap-1 rounded-[3px] bg-accent px-1.5 py-0.5 text-[0.52rem] text-accent-ink">
            <Download className="size-2.5" />
            Download
          </div>
        </div>
      </div>
    </div>
  );
}

const organizerSteps = [
  {
    title: "Upload your list and designs",
    body: "Bring your spreadsheet and certificate images. Acclaimo reads the list in your browser.",
    icon: Spreadsheet,
    preview: <SheetPreview />,
  },
  {
    title: "Place the name and position",
    body: "Drag the text boxes where they belong. Use a different design for each category if you need to.",
    icon: CursorBox,
    preview: <DesignerPreview />,
  },
  {
    title: "Share one link",
    body: "Publish, then send the link to your WhatsApp group. No files to forward one by one.",
    icon: LinkIcon,
    preview: <SharePreview />,
  },
];

const studentSteps = [
  {
    title: "Type your full name",
    body: "No account, no email. Just the name used on the registration form.",
    icon: Phone,
    preview: <StudentInputPreview />,
  },
  {
    title: "Download the certificate",
    body: "The right design and position are chosen automatically. PDF or image.",
    icon: Download,
    preview: <StudentDownloadPreview />,
  },
];

function StepGrid({
  steps,
  columns,
}: {
  steps: typeof organizerSteps;
  columns: string;
}) {
  return (
    <div className={`grid gap-8 ${columns}`}>
      {steps.map((step, index) => {
        const Icon = step.icon;
        return (
          <div key={step.title} className="border-t border-line pt-5">
            <div className="flex items-center justify-between">
              <span className="font-serif text-lg tabular-nums text-accent">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Icon className="size-[18px] text-muted" />
            </div>
            <h3 className="mt-3 text-[1.02rem] font-semibold leading-snug">{step.title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">{step.body}</p>
            <MiniPanel>{step.preview}</MiniPanel>
          </div>
        );
      })}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="border-y border-line bg-surface py-16 sm:py-20">
      <div className="container-page">
        <div className="max-w-2xl">
          <p className="eyebrow">How it works</p>
          <h2 className="mt-3 font-serif text-title font-semibold text-balance">
            Three steps for you. Two for them.
          </h2>
          <p className="mt-4 text-[1.02rem] leading-relaxed text-muted">
            The setup happens once. After that, students only need the link and the name they
            registered with.
          </p>
        </div>

        <div className="mt-12">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            For organizers
          </p>
          <div className="mt-5">
            <StepGrid steps={organizerSteps} columns="md:grid-cols-3" />
          </div>
        </div>

        <div className="mt-14">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-muted">
            For students
          </p>
          <div className="mt-5">
            <StepGrid steps={studentSteps} columns="md:grid-cols-2" />
          </div>
        </div>
      </div>
    </section>
  );
}
