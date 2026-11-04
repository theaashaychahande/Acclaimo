import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";
import { PageIntro } from "../components/layout/PageIntro";
import { Button, buttonClasses } from "../components/ui/Button";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Close,
  CursorBox,
  Download,
  Github,
  Info,
  LinkIcon,
  Menu,
  Moon,
  Phone,
  Plus,
  Send,
  Shield,
  Spreadsheet,
  Sun,
  Upload,
} from "../components/ui/Icons";
import { cn } from "../lib/cn";

const colors = [
  ["paper", "--c-paper", "Page background"],
  ["surface", "--c-surface", "Panels and cards"],
  ["surface-muted", "--c-surface-muted", "Quiet fills"],
  ["surface-sunken", "--c-surface-sunken", "Preview wells"],
  ["ink", "--c-ink", "Primary text"],
  ["ink-soft", "--c-ink-soft", "Secondary text"],
  ["muted", "--c-muted", "Helper text"],
  ["line", "--c-line", "Borders"],
  ["line-strong", "--c-line-strong", "Input borders"],
  ["accent", "--c-accent", "Primary action"],
  ["accent-soft", "--c-accent-soft", "Accent wash"],
  ["danger", "--c-danger", "Destructive action"],
];

const typeScale = [
  ["Display", "text-display font-serif font-semibold", "Certificates, without the folder."],
  ["Title", "text-title font-serif font-semibold", "Three steps for you. Two for them."],
  ["Subtitle", "text-subtitle font-serif font-semibold", "Everyone gets the right certificate."],
  ["Body", "text-base", "Students type their name and download their certificate."],
  ["Small", "text-sm text-muted", "Use the same name you gave when registering."],
];

const spacing = [1, 2, 3, 4, 6, 8, 12, 16];

const icons = [
  ["Arrow right", ArrowRight],
  ["Arrow left", ArrowLeft],
  ["Menu", Menu],
  ["Close", Close],
  ["Sun", Sun],
  ["Moon", Moon],
  ["Check", Check],
  ["Download", Download],
  ["Upload", Upload],
  ["Link", LinkIcon],
  ["Shield", Shield],
  ["Spreadsheet", Spreadsheet],
  ["Design box", CursorBox],
  ["Send", Send],
  ["Chevron", ChevronDown],
  ["Plus", Plus],
  ["Info", Info],
  ["Phone", Phone],
  ["GitHub", Github],
] as const;

function DemoSection({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: ReactNode;
}) {
  return (
    <section className="border-t border-line pt-10">
      <h2 className="font-serif text-2xl font-semibold">{title}</h2>
      {note ? <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">{note}</p> : null}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "danger" }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium",
        tone === "neutral" && "border-line bg-surface text-ink-soft",
        tone === "accent" && "border-accent/30 bg-accent-soft text-accent",
        tone === "danger" && "border-danger/30 bg-danger-soft text-danger",
      )}
    >
      {children}
    </span>
  );
}

const tabPanels = [
  "Event name, date, and an optional description.",
  "Upload a CSV or Excel sheet. The file is read in the browser.",
  "Place the name and position on each category's template.",
];

const tabNames = ["Details", "Participants", "Design"];

export function DesignPage() {
  const [toast, setToast] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [tab, setTab] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(false), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!sheetOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSheetOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sheetOpen]);

  function openModal() {
    dialogRef.current?.showModal();
  }

  function closeModal() {
    dialogRef.current?.close();
  }

  function onTabKeyDown(event: ReactKeyboardEvent<HTMLButtonElement>, index: number) {
    if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") return;
    event.preventDefault();
    const next = event.key === "ArrowRight" ? (index + 1) % tabNames.length : (index - 1 + tabNames.length) % tabNames.length;
    setTab(next);
    document.getElementById(`design-tab-${next}`)?.focus();
  }

  return (
    <PageIntro
      eyebrow="Design system"
      title="The pieces Acclaimo is built from."
      intro="Colours, type, spacing, and controls in one place. This page is for development; it is not linked from the public navigation."
    >
      <div className="space-y-10">
        <DemoSection
          title="Colour"
          note="Warm paper, near-black ink, and one deep teal accent. Dark mode is a separate palette, not an inversion. Every value is a CSS variable."
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {colors.map(([name, variable, usage]) => (
              <div key={name} className="rounded-[6px] border border-line bg-surface p-3">
                <div
                  className="h-14 rounded-[3px] border border-line"
                  style={{ background: `var(${variable})` }}
                />
                <p className="mt-2.5 text-sm font-medium">{name}</p>
                <p className="mt-0.5 font-mono text-[0.68rem] text-muted">{variable}</p>
                <p className="mt-1 text-xs text-muted">{usage}</p>
              </div>
            ))}
          </div>
        </DemoSection>

        <DemoSection title="Typography" note="Source Serif 4 for headings, Public Sans for everything else. Two families, no more.">
          <div className="space-y-6">
            {typeScale.map(([label, className, sample]) => (
              <div key={label} className="grid gap-2 border-t border-line pt-4 sm:grid-cols-[7rem_1fr] sm:gap-6">
                <p className="text-xs uppercase tracking-[0.12em] text-muted">{label}</p>
                <p className={className}>{sample}</p>
              </div>
            ))}
          </div>
        </DemoSection>

        <DemoSection title="Spacing" note="A 4px grid. Components use the same steps for padding, gaps, and vertical rhythm.">
          <div className="space-y-2">
            {spacing.map((step) => (
              <div key={step} className="flex items-center gap-3">
                <span className="w-12 text-right font-mono text-xs text-muted">{step}</span>
                <div className="h-2 rounded-sm bg-accent-soft" style={{ width: `${step * 4}px` }} />
                <span className="text-xs text-muted">{step * 4}px</span>
              </div>
            ))}
          </div>
        </DemoSection>

        <DemoSection title="Buttons" note="44px minimum height on the controls people use with a thumb. Rounded corners stay small and quiet.">
          <div className="flex flex-wrap items-center gap-3">
            <Button>Create your organization</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Delete event</Button>
            <Button disabled>Disabled</Button>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button size="sm">Small</Button>
            <Button size="md">Medium</Button>
            <Button size="lg">Large</Button>
            <a href="/" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Link styled as a button
            </a>
          </div>
        </DemoSection>

        <DemoSection title="Form fields" note="Labels are always visible. Errors say what happened and what to do next.">
          <div className="grid max-w-2xl gap-6 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor="demo-org" className="text-sm font-medium">
                Organization name
              </label>
              <input
                id="demo-org"
                className="mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 py-2.5 text-base placeholder:text-muted/70"
                placeholder="Mechanical Engineering Department"
              />
              <p className="mt-1.5 text-xs text-muted">This appears on the student page.</p>
            </div>

            <div>
              <label htmlFor="demo-category" className="text-sm font-medium">
                Category
              </label>
              <div className="relative mt-1.5">
                <select
                  id="demo-category"
                  className="w-full appearance-none rounded-md border border-line-strong bg-surface px-3 py-2.5 pr-9 text-base"
                  defaultValue="winner"
                >
                  <option value="participant">Participant</option>
                  <option value="winner">Winner</option>
                  <option value="runner">1st Runner Up</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted" />
              </div>
            </div>

            <div>
              <label htmlFor="demo-key" className="text-sm font-medium">
                Edit key
              </label>
              <input
                id="demo-key"
                aria-invalid="true"
                aria-describedby="demo-key-error"
                className="mt-1.5 w-full rounded-md border border-danger bg-surface px-3 py-2.5 text-base"
                defaultValue="accl-8f2"
              />
              <p id="demo-key-error" className="mt-1.5 text-xs text-danger">
                That key did not work. Check for extra spaces and try again.
              </p>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="demo-note" className="text-sm font-medium">
                Internal note
              </label>
              <textarea
                id="demo-note"
                rows={3}
                className="mt-1.5 w-full rounded-md border border-line-strong bg-surface px-3 py-2.5 text-base placeholder:text-muted/70"
                placeholder="Optional"
              />
            </div>

            <label className="flex items-start gap-2.5 text-sm">
              <input type="checkbox" className="mt-0.5 size-4 accent-[var(--c-accent)]" />
              <span>
                I saved my edit key
                <span className="mt-0.5 block text-xs text-muted">
                  It will not be shown again.
                </span>
              </span>
            </label>
          </div>
        </DemoSection>

        <DemoSection title="Badges" note="Status is never carried by colour alone; the label always says what it means.">
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">Live</Badge>
            <Badge>Draft</Badge>
            <Badge>Paused</Badge>
            <Badge>Expired</Badge>
            <Badge tone="danger">Disabled</Badge>
            <Badge tone="accent">Winner</Badge>
          </div>
        </DemoSection>

        <DemoSection title="Tabs" note="Arrow keys move between tabs. The panel stays in the same place so the page does not jump.">
          <div className="max-w-xl">
            <div role="tablist" aria-label="Event setup" className="flex gap-1 border-b border-line">
              {tabNames.map((name, index) => (
                <button
                  key={name}
                  id={`design-tab-${index}`}
                  role="tab"
                  aria-selected={tab === index}
                  aria-controls={`design-panel-${index}`}
                  tabIndex={tab === index ? 0 : -1}
                  onClick={() => setTab(index)}
                  onKeyDown={(event) => onTabKeyDown(event, index)}
                  className={cn(
                    "-mb-px inline-flex min-h-11 items-center border-b-2 px-3 text-sm font-medium",
                    tab === index
                      ? "border-accent text-ink"
                      : "border-transparent text-muted hover:text-ink",
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
            {tabPanels.map((panel, index) => (
              <div
                key={panel}
                id={`design-panel-${index}`}
                role="tabpanel"
                aria-labelledby={`design-tab-${index}`}
                hidden={tab !== index}
                className="pt-4 text-sm leading-relaxed text-muted"
              >
                {panel}
              </div>
            ))}
          </div>
        </DemoSection>

        <DemoSection title="Empty state" note="Blank pages should tell the organizer what comes next.">
          <div className="max-w-xl rounded-[8px] border border-dashed border-line-strong bg-surface p-8 text-center">
            <div className="mx-auto grid size-10 place-items-center rounded-full bg-accent-soft text-accent">
              <Plus className="size-5" />
            </div>
            <h3 className="mt-4 font-serif text-xl font-semibold">No events yet</h3>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted">
              Create your first event, add a participant list, and share one link.
            </p>
            <Button size="sm" className="mt-5">
              Create an event
            </Button>
          </div>
        </DemoSection>

        <DemoSection title="Skeleton" note="Loading states keep the same shape as the content that replaces them.">
          <div className="grid max-w-xl gap-4 sm:grid-cols-[1fr_1.5fr]">
            <div className="skeleton aspect-[1.414/1] rounded-[5px]" />
            <div className="space-y-3 py-2">
              <div className="skeleton h-3 w-1/3 rounded-sm" />
              <div className="skeleton h-5 w-4/5 rounded-sm" />
              <div className="skeleton h-3 w-full rounded-sm" />
              <div className="skeleton h-3 w-2/3 rounded-sm" />
              <div className="skeleton h-10 w-36 rounded-md" />
            </div>
          </div>
        </DemoSection>

        <DemoSection title="Icons" note="One line style, 1.6px stroke, used sparingly. No emoji.">
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-7">
            {icons.map(([label, Icon]) => (
              <div
                key={label}
                className="flex flex-col items-center gap-1.5 rounded-[6px] border border-line bg-surface px-2 py-3 text-center"
              >
                <Icon className="size-5 text-ink-soft" />
                <span className="text-[0.65rem] leading-tight text-muted">{label}</span>
              </div>
            ))}
          </div>
        </DemoSection>

        <DemoSection title="Overlays" note="A toast for feedback, a modal for a decision, and a bottom sheet for mobile controls.">
          <div className="flex flex-wrap gap-3">
            <Button variant="secondary" onClick={() => setToast(true)}>
              Show toast
            </Button>
            <Button variant="secondary" onClick={openModal}>
              Open modal
            </Button>
            <Button variant="secondary" onClick={() => setSheetOpen(true)}>
              Open bottom sheet
            </Button>
          </div>

          <dialog
            ref={dialogRef}
            aria-labelledby="delete-title"
            className="w-[calc(100%-2rem)] max-w-md rounded-[10px] border border-line bg-surface p-6 text-ink backdrop:bg-black/40"
            onClick={(event) => {
              if (event.target === dialogRef.current) closeModal();
            }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="delete-title" className="font-serif text-xl font-semibold">
                  Delete this event?
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  This removes the participant hashes, categories, and templates. It cannot be
                  undone.
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                aria-label="Close dialog"
                className="grid size-11 shrink-0 place-items-center rounded-md hover:bg-surface-muted"
              >
                <Close className="size-4" />
              </button>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <Button variant="secondary" size="sm" onClick={closeModal}>
                Cancel
              </Button>
              <Button variant="destructive" size="sm" onClick={closeModal}>
                Delete event
              </Button>
            </div>
          </dialog>
        </DemoSection>
      </div>

      {toast ? (
        <div
          role="status"
          className="fixed bottom-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-md border border-line bg-ink px-4 py-3 text-sm text-paper sm:left-auto sm:right-5 sm:translate-x-0"
        >
          List saved. 428 participants are ready.
        </div>
      ) : null}

      {sheetOpen ? (
        <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={() => setSheetOpen(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="sheet-title"
            className="w-full rounded-t-[14px] border-t border-line bg-surface p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-line-strong" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <h2 id="sheet-title" className="font-serif text-xl font-semibold">
                Design controls
              </h2>
              <button
                type="button"
                onClick={() => setSheetOpen(false)}
                aria-label="Close bottom sheet"
                className="grid size-11 place-items-center rounded-md hover:bg-surface-muted"
              >
                <Close className="size-4" />
              </button>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              On a phone, the certificate preview stays on top and the controls slide up from the
              bottom like this.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-3">
              <Button variant="secondary" size="sm">
                Choose font
              </Button>
              <Button variant="secondary" size="sm">
                Edit position
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </PageIntro>
  );
}
