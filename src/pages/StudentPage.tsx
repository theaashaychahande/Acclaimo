import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";
import { buttonClasses } from "../components/ui/Button";
import { Download, Info, Shield } from "../components/ui/Icons";
import {
  fetchPublicOrg,
  getTemplateUrl,
  isLinkId,
  lookupParticipant,
  recordDownload,
  type LookupMatch,
  type PublicOrgResponse,
} from "../lib/api";
import { hashName, hashNameWithIdentifier } from "../shared/hash";
import { describeError } from "../lib/errors";
import {
  canvasToBlob,
  downloadBlob,
  loadTemplateImage,
  openPrintWindow,
  renderCertificate,
  safeFileName,
} from "../lib/certificate";

type ReadyOrg = Extract<PublicOrgResponse, { status: "ok" }>;

type OrgState =
  | { kind: "loading" }
  | { kind: "ready"; data: ReadyOrg }
  | { kind: "closed" }
  | { kind: "error"; message: string };

type LookupState =
  | { kind: "idle" }
  | { kind: "searching" }
  | { kind: "found"; matches: LookupMatch[] }
  | { kind: "needs_identifier" }
  | { kind: "not_found" }
  | { kind: "rate_limited"; seconds: number }
  | { kind: "error"; message: string };

function friendlyError(error: unknown): string {
  return describeError(error, "Something went wrong on our side. Please try again.");
}

export function StudentPage() {
  const { linkId = "" } = useParams();
  const [org, setOrg] = useState<OrgState>({ kind: "loading" });
  const [name, setName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [lookup, setLookup] = useState<LookupState>({ kind: "idle" });

  const validLink = isLinkId(linkId);

  useEffect(() => {
    let cancelled = false;

    if (!validLink) {
      setOrg({ kind: "closed" });
      return;
    }

    setOrg({ kind: "loading" });

    fetchPublicOrg(linkId)
      .then((response) => {
        if (cancelled) return;

        if (response.status === "ok") {
          setOrg({ kind: "ready", data: response });
        } else {
          setOrg({ kind: "closed" });
        }
      })
      .catch((error: unknown) => {
        if (!cancelled) setOrg({ kind: "error", message: friendlyError(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [linkId, validLink]);

  const runLookup = async (withIdentifier: boolean) => {
    if (org.kind !== "ready") return;

    const cleanName = name.trim();
    if (cleanName.length < 2) {
      setLookup({
        kind: "error",
        message: "Enter your full name, the same one you used when you registered.",
      });
      return;
    }

    if (withIdentifier && identifier.trim().length < 1) {
      setLookup({
        kind: "error",
        message: "Enter the roll number or identifier you registered with.",
      });
      return;
    }

    setLookup({ kind: "searching" });

    try {
      const salt = org.data.organization.salt;
      const nameHash = await hashName(salt, cleanName);
      const identifierHash =
        withIdentifier && identifier.trim()
          ? await hashNameWithIdentifier(salt, cleanName, identifier.trim())
          : null;

      const response = await lookupParticipant({ linkId, nameHash, identifierHash });

      switch (response.status) {
        case "ok":
          setLookup({ kind: "found", matches: response.matches });
          break;
        case "needs_identifier":
          setLookup({ kind: "needs_identifier" });
          break;
        case "not_found":
          setLookup({ kind: "not_found" });
          break;
        case "rate_limited":
          setLookup({ kind: "rate_limited", seconds: response.retry_after_seconds });
          break;
        default:
          setLookup({
            kind: "error",
            message:
              response.code === "template_missing"
                ? "The organizers are still finishing the certificate design. Please try again later."
                : "Something went wrong while looking up your certificate. Please try again.",
          });
      }
    } catch (error) {
      setLookup({ kind: "error", message: friendlyError(error) });
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    void runLookup(lookup.kind === "needs_identifier");
  };

  if (org.kind === "loading") {
    return (
      <PageIntro eyebrow="Your certificate" title="Opening your certificate link">
        <div className="max-w-2xl space-y-3" aria-live="polite">
          <div className="skeleton h-5 w-48 rounded" />
          <div className="skeleton h-12 w-full rounded" />
          <div className="skeleton h-11 w-40 rounded" />
        </div>
      </PageIntro>
    );
  }

  if (org.kind === "closed") {
    return (
      <PageIntro eyebrow="Your certificate" title="This link is not open">
        <NoticePanel title="This certificate link has closed.">
          <p>
            The organizers have paused or removed this link, or it has expired. Please ask
            them for a fresh link or contact them directly.
          </p>
        </NoticePanel>
      </PageIntro>
    );
  }

  if (org.kind === "error") {
    return (
      <PageIntro eyebrow="Your certificate" title="We could not open this link">
        <NoticePanel title="Something went wrong.">
          <p>{org.message}</p>
          <p className="mt-3">
            Check your connection and reload the page. If it keeps happening, contact the
            organizers.
          </p>
        </NoticePanel>
      </PageIntro>
    );
  }

  const { organization, events } = org.data;

  return (
    <PageIntro
      eyebrow={organization.department_or_club}
      title={organization.name}
      intro={
        events.length > 0
          ? "Enter your name the way you wrote it when you registered, and we will find your certificate."
          : "This organization has no open events right now."
      }
    >
      <div className="max-w-2xl">
        {events.length > 1 ? (
          <div className="mb-6 flex flex-wrap gap-2" aria-label="Open events">
            {events.map((event) => (
              <span
                key={event.id}
                className="rounded-full border border-line bg-surface px-3 py-1 text-xs font-medium text-muted"
              >
                {event.name}
              </span>
            ))}
          </div>
        ) : null}

        {events.length === 0 ? (
          <NoticePanel title="Nothing to download yet.">
            <p>
              There is no live event here at the moment. Keep the link and try again once the
              organizers publish.
            </p>
          </NoticePanel>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <label htmlFor="student-name" className="block text-sm font-medium">
                Your full name
              </label>
              <input
                id="student-name"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  if (lookup.kind !== "idle" && lookup.kind !== "searching") {
                    setLookup({ kind: "idle" });
                  }
                }}
                placeholder="e.g. Aashay Chahande"
                autoComplete="name"
                required
                className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-3 text-base text-ink placeholder:text-muted"
              />
              <p className="mt-2 text-sm text-muted">
                Use the same name you gave when registering.
              </p>
            </div>

            {lookup.kind === "needs_identifier" ? (
              <div>
                <label htmlFor="student-identifier" className="block text-sm font-medium">
                  Roll number or identifier
                </label>
                <input
                  id="student-identifier"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  placeholder="e.g. CS21B001"
                  autoComplete="off"
                  required
                  className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-3 text-base text-ink placeholder:text-muted"
                />
                <p className="mt-2 text-sm text-muted">
                  More than one participant has this name. The identifier tells them apart.
                </p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={lookup.kind === "searching"}
              className={buttonClasses({ variant: "primary", size: "lg", full: true })}
            >
              {lookup.kind === "searching" ? "Looking up…" : "Find my certificate"}
            </button>
          </form>
        )}

        <div aria-live="polite" className="mt-8 space-y-6">
          {lookup.kind === "found" ? (
            <FoundResults
              matches={lookup.matches}
              studentName={name.trim()}
              organizationName={organization.name}
              linkId={linkId}
            />
          ) : null}

          {lookup.kind === "not_found" ? (
            <NoticePanel title="We could not find that name.">
              <p>Check the spelling, or try the name exactly as it appears on your registration.</p>
              <ul className="mt-4 list-disc space-y-2 pl-5">
                <li>Try the full name, not a nickname.</li>
                <li>Use the same capitalization and spelling as the registration list.</li>
                <li>If your name has two parts, try both words together.</li>
              </ul>
              {organization.public_contact ? (
                <p className="mt-4">
                  Still stuck? Contact the organizers at{" "}
                  <a className="underline" href={contactHref(organization.public_contact)}>
                    {organization.public_contact}
                  </a>
                  .
                </p>
              ) : (
                <p className="mt-4">Still stuck? Ask the organizers to check the participant list.</p>
              )}
            </NoticePanel>
          ) : null}

          {lookup.kind === "rate_limited" ? (
            <NoticePanel title="Please wait a moment.">
              <p>
                Too many lookups from this device. Try again in {lookup.seconds} second
                {lookup.seconds === 1 ? "" : "s"}.
              </p>
              <p className="mt-3">
                This protects the participant list. Nothing has changed on your certificate.
              </p>
            </NoticePanel>
          ) : null}

          {lookup.kind === "error" ? (
            <NoticePanel title="That did not work.">
              <p>{lookup.message}</p>
            </NoticePanel>
          ) : null}
        </div>

        <div className="mt-10 flex items-start gap-3 rounded-[8px] border border-line bg-surface p-4 text-sm text-muted">
          <Shield className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p>
            Acclaimo only stores a salted hash of each name. Your name is never saved in
            readable form, and nothing is sent to a third party.
          </p>
        </div>

        {organization.public_contact ? (
          <p className="mt-6 text-sm text-muted">
            Questions about this event? Contact{" "}
            <a className="underline" href={contactHref(organization.public_contact)}>
              {organization.public_contact}
            </a>
            .
          </p>
        ) : null}
      </div>
    </PageIntro>
  );
}

function contactHref(contact: string): string {
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(contact)) return `mailto:${contact}`;

  return `tel:${contact.replace(/[^\d+]/g, "")}`;
}

function FoundResults({
  matches,
  studentName,
  organizationName,
  linkId,
}: {
  matches: LookupMatch[];
  studentName: string;
  organizationName: string;
  linkId: string;
}) {
  return (
    <>
      <div className="flex items-start gap-3 rounded-[8px] border border-accent-soft bg-accent-soft p-4 text-sm text-ink-soft">
        <Info className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <p>
          Found {matches.length === 1 ? "your certificate" : `${matches.length} certificates`}.
          The file is created on your own device, so nothing is uploaded.
        </p>
      </div>

      {matches.map((match) => (
        <MatchCard
          key={`${match.event_id}-${match.category.id}`}
          match={match}
          studentName={studentName}
          organizationName={organizationName}
          linkId={linkId}
        />
      ))}
    </>
  );
}

function MatchCard({
  match,
  studentName,
  organizationName,
  linkId,
}: {
  match: LookupMatch;
  studentName: string;
  organizationName: string;
  linkId: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const run = async () => {
      setStatus("loading");
      setMessage(null);

      try {
        let template: HTMLImageElement | null = null;

        if (match.category.template_path) {
          const signed = await getTemplateUrl(match.category.template_path);
          if (signed.status === "ok") {
            template = await loadTemplateImage(signed.url);
          }
        }

        if (cancelled) return;

        const rendered = await renderCertificate({
          template,
          design: match.category.design_settings ?? {},
          name: studentName,
          positionText: match.position_text,
          eventName: match.event_name,
          organizationName,
          categoryLabel: match.category.label,
        });

        const host = canvasRef.current;
        if (host) {
          host.width = rendered.width;
          host.height = rendered.height;
          const context = host.getContext("2d");
          if (context) context.drawImage(rendered, 0, 0);
        }

        if (!cancelled) setStatus("ready");
      } catch (error) {
        if (!cancelled) {
          setMessage(
            error instanceof Error
              ? error.message
              : "We could not create your certificate on this device. Try another browser.",
          );
          setStatus("error");
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [match, studentName, organizationName]);

  const download = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      const blob = await canvasToBlob(canvas);
      downloadBlob(blob, safeFileName(match.event_name, studentName));

      void recordDownload({
        linkId,
        eventId: match.event_id,
        categoryId: match.category.id,
      });
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "We could not save the file. Try another browser.",
      );
      setStatus("error");
    }
  };

  const print = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    try {
      openPrintWindow(
        canvas.toDataURL("image/png"),
        `${match.event_name} certificate`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "The print window could not open.",
      );
    }
  };

  return (
    <article className="rounded-[8px] border border-line bg-surface p-5 sm:p-6">
      <header className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="font-serif text-xl font-semibold">{match.event_name}</h3>
          <p className="mt-1 text-sm text-muted">
            {match.category.label}
            {match.position_text ? ` · ${match.position_text}` : ""}
          </p>
        </div>
        <span className="text-xs font-medium uppercase tracking-[0.12em] text-muted">
          {formatDate(match.event_date)}
        </span>
      </header>

      <div className="mt-4 overflow-hidden rounded border border-line bg-surface-muted">
        {status === "loading" ? (
          <div className="skeleton aspect-[1.414/1] w-full" aria-hidden="true" />
        ) : null}

        <canvas
          ref={canvasRef}
          aria-label={`Certificate for ${studentName} at ${match.event_name}`}
          className={status === "ready" ? "block h-auto w-full" : "hidden"}
        />
      </div>

      {status === "error" ? (
        <p className="mt-3 text-sm text-danger">{message}</p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => void download()}
          disabled={status !== "ready"}
          className={buttonClasses({ variant: "primary", size: "md" })}
        >
          <Download className="size-4" aria-hidden="true" />
          Download image
        </button>
        <button
          type="button"
          onClick={print}
          disabled={status !== "ready"}
          className={buttonClasses({ variant: "secondary", size: "md" })}
        >
          Print or save as PDF
        </button>
      </div>

      <p className="mt-3 text-xs text-muted">
        If the file does not appear, check your browser downloads. In WhatsApp, open the
        link in Safari or Chrome first.
      </p>
    </article>
  );
}

function formatDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
