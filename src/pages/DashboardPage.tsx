import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";
import { buttonClasses } from "../components/ui/Button";
import { Check, LinkIcon, Plus, Send } from "../components/ui/Icons";
import {
  addParticipants,
  clearParticipants,
  createCategory,
  createEvent,
  deleteEvent,
  fetchDashboard,
  setEventStatus,
  type DashboardEvent,
  type DashboardResponse,
  type ParticipantRow,
} from "../lib/api";
import { clearSession, loadSession, type OrganizerSession } from "../lib/session";
import { hashName } from "../shared";

type ReadyData = Extract<DashboardResponse, { status: "ok" }>;
type PageState =
  | { kind: "loading" }
  | { kind: "ready"; data: ReadyData }
  | { kind: "error"; message: string };

type Notice = { tone: "ok" | "error"; text: string };

export function DashboardPage() {
  const navigate = useNavigate();
  const [session] = useState<OrganizerSession | null>(() => loadSession());
  const [state, setState] = useState<PageState>({ kind: "loading" });
  const [notice, setNotice] = useState<Notice | null>(null);

  useEffect(() => {
    if (!session) {
      navigate("/login", { replace: true });
      return;
    }

    let cancelled = false;

    fetchDashboard(session.editKeyHash)
      .then((response) => {
        if (cancelled) return;

        if (response.status === "invalid_key") {
          clearSession();
          navigate("/login", { replace: true });
          return;
        }

        setState({ kind: "ready", data: response });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({
          kind: "error",
          message:
            error instanceof Error && error.message
              ? error.message
              : "We could not load your dashboard. Please reload the page.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [session, navigate]);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(null), 5000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  const refresh = async () => {
    if (!session) return;

    try {
      const response = await fetchDashboard(session.editKeyHash);

      if (response.status === "invalid_key") {
        clearSession();
        navigate("/login", { replace: true });
        return;
      }

      setState({ kind: "ready", data: response });
    } catch (error) {
      setNotice({
        tone: "error",
        text:
          error instanceof Error && error.message
            ? error.message
            : "Could not refresh. Try again.",
      });
    }
  };

  const logout = () => {
    clearSession();
    navigate("/login", { replace: true });
  };

  if (!session) return null;

  if (state.kind === "loading") {
    return (
      <PageIntro eyebrow="Organizer dashboard" title="Loading your events">
        <div className="space-y-3" aria-live="polite">
          <div className="skeleton h-24 w-full rounded" />
          <div className="skeleton h-24 w-full rounded" />
        </div>
      </PageIntro>
    );
  }

  if (state.kind === "error") {
    return (
      <PageIntro eyebrow="Organizer dashboard" title="Your events">
        <NoticePanel title="We could not load your dashboard.">
          <p>{state.message}</p>
          <button
            type="button"
            onClick={() => void refresh()}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Try again
          </button>
        </NoticePanel>
      </PageIntro>
    );
  }

  const { organization, events } = state.data;
  const shareUrl = `${window.location.origin}/o/${organization.link_id}`;

  return (
    <PageIntro
      eyebrow={organization.department_or_club}
      title={organization.name}
      intro="Create an event, paste your participant list, then publish the link you will share with students."
    >
      <div className="space-y-8">
        {notice ? (
          <div
            role="status"
            className={`rounded-[8px] border p-4 text-sm ${
              notice.tone === "error"
                ? "border-danger bg-danger-soft text-ink"
                : "border-accent-soft bg-accent-soft text-ink"
            }`}
          >
            {notice.text}
          </div>
        ) : null}

        <SharePanel shareUrl={shareUrl} />

        <CreateEventForm
          editKeyHash={session.editKeyHash}
          onCreated={async (message) => {
            setNotice({ tone: "ok", text: message });
            await refresh();
          }}
          onError={(message) => setNotice({ tone: "error", text: message })}
        />

        <section aria-labelledby="events-heading" className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <h2 id="events-heading" className="font-serif text-2xl font-semibold">
              Events
            </h2>
            <button
              type="button"
              onClick={logout}
              className={buttonClasses({ variant: "ghost", size: "sm" })}
            >
              Log out
            </button>
          </div>

          {events.length === 0 ? (
            <NoticePanel title="No events yet.">
              <p>
                Create your first event above. It stays a draft until you add participants
                and publish it.
              </p>
            </NoticePanel>
          ) : (
            <div className="space-y-4">
              {events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  salt={organization.salt}
                  editKeyHash={session.editKeyHash}
                  onChanged={refresh}
                  onNotice={setNotice}
                />
              ))}
            </div>
          )}
        </section>

        <section className="rounded-[8px] border border-line bg-surface p-5">
          <h2 className="font-serif text-xl font-semibold">Security</h2>
          <p className="mt-2 text-sm text-muted">
            We store only the hash of your edit key, never the key itself. Your session ends
            when you close this tab or after eight hours.
          </p>
        </section>
      </div>
    </PageIntro>
  );
}

function SharePanel({ shareUrl }: { shareUrl: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const field = document.getElementById("share-url") as HTMLInputElement | null;
      field?.select();
    }
  };

  const whatsapp = `https://wa.me/?text=${encodeURIComponent(
    `Your certificate is ready. Open this link, type your name, and download it: ${shareUrl}`,
  )}`;

  return (
    <section className="rounded-[8px] border border-line bg-surface p-5">
      <h2 className="font-serif text-xl font-semibold">Your student link</h2>
      <p className="mt-2 text-sm text-muted">
        After you publish an event, share this link in your WhatsApp group.
      </p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <input
          id="share-url"
          readOnly
          value={shareUrl}
          onFocus={(event) => event.currentTarget.select()}
          className="w-full rounded-md border border-line bg-surface-muted px-3 py-2.5 font-mono text-sm text-ink"
        />
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void copy()}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            <LinkIcon className="size-4" aria-hidden="true" />
            {copied ? "Copied" : "Copy"}
          </button>
          <a
            href={whatsapp}
            target="_blank"
            rel="noreferrer"
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            <Send className="size-4" aria-hidden="true" />
            WhatsApp
          </a>
        </div>
      </div>
    </section>
  );
}

function CreateEventForm({
  editKeyHash,
  onCreated,
  onError,
}: {
  editKeyHash: string;
  onCreated: (message: string) => Promise<void>;
  onError: (message: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={buttonClasses({ variant: "primary", size: "md" })}
      >
        <Plus className="size-4" aria-hidden="true" />
        Create an event
      </button>
    );
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (saving) return;

    const cleanName = name.trim();

    if (!cleanName) {
      onError("Give the event a name.");
      return;
    }

    setSaving(true);

    try {
      const created = await createEvent({
        editKeyHash,
        name: cleanName,
        date,
        description: description.trim() || null,
      });

      if (created.status !== "ok") {
        onError("Your session expired. Please log in again.");
        return;
      }

      const category = await createCategory({
        editKeyHash,
        eventId: created.event.id,
        label: "Participant",
        sortOrder: 0,
      });

      setName("");
      setDescription("");
      setOpen(false);

      await onCreated(
        category.status === "ok"
          ? `"${cleanName}" is ready. Add participants next.`
          : `"${cleanName}" was created, but the default category failed. Add one before publishing.`,
      );
    } catch (error) {
      onError(
        error instanceof Error && error.message
          ? error.message
          : "Your event was not created. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <form
      onSubmit={submit}
      className="rounded-[8px] border border-line bg-surface p-5"
      noValidate
    >
      <h2 className="font-serif text-xl font-semibold">New event</h2>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="event-name" className="block text-sm font-medium text-ink">
            Event name
          </label>
          <input
            id="event-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="e.g. MECHMERISE 2026"
            maxLength={120}
            required
            className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted"
          />
        </div>

        <div>
          <label htmlFor="event-date" className="block text-sm font-medium text-ink">
            Event date
          </label>
          <input
            id="event-date"
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            required
            className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink"
          />
        </div>
      </div>

      <div className="mt-4">
        <label htmlFor="event-description" className="block text-sm font-medium text-ink">
          Description <span className="font-normal text-muted">(optional)</span>
        </label>
        <textarea
          id="event-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          rows={2}
          maxLength={2000}
          className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink"
        />
      </div>

      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className={buttonClasses({ variant: "primary", size: "sm" })}
        >
          {saving ? "Creating…" : "Create event"}
        </button>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className={buttonClasses({ variant: "ghost", size: "sm" })}
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

function EventCard({
  event,
  salt,
  editKeyHash,
  onChanged,
  onNotice,
}: {
  event: DashboardEvent;
  salt: string;
  editKeyHash: string;
  onChanged: () => Promise<void>;
  onNotice: (notice: Notice) => void;
}) {
  const [busy, setBusy] = useState(false);
  const primaryCategory = event.default_category_id ?? event.categories[0]?.id ?? null;
  const participants = event.categories.reduce(
    (total, category) => total + category.participant_count,
    0,
  );

  const changeStatus = async (status: "live" | "paused") => {
    if (busy) return;
    setBusy(true);

    try {
      const expiry =
        status === "live"
          ? event.expiry_date ?? expiryInDays(30)
          : event.expiry_date;

      const response = await setEventStatus({
        editKeyHash,
        eventId: event.id,
        status,
        expiryDate: expiry,
      });

      if (response.status === "ok") {
        onNotice({
          tone: "ok",
          text: status === "live" ? "Event published." : "Event paused.",
        });
        await onChanged();
      } else if (response.status === "error") {
        onNotice({ tone: "error", text: statusMessage(response.code) });
      } else {
        onNotice({ tone: "error", text: "Your session expired. Please log in again." });
      }
    } catch (error) {
      onNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const extend = async () => {
    if (busy) return;
    setBusy(true);

    try {
      const response = await setEventStatus({
        editKeyHash,
        eventId: event.id,
        status: event.status === "paused" ? "paused" : event.status,
        expiryDate: expiryInDays(30),
      });

      if (response.status === "ok") {
        onNotice({ tone: "ok", text: "Expiry moved 30 days from today." });
        await onChanged();
      } else if (response.status === "error") {
        onNotice({ tone: "error", text: statusMessage(response.code) });
      }
    } catch (error) {
      onNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    const answer = window.prompt(
      `This deletes "${event.name}" and its participant hashes. Type DELETE to confirm.`,
    );

    if (answer !== "DELETE") return;
    if (busy) return;

    setBusy(true);

    try {
      const response = await deleteEvent({ editKeyHash, eventId: event.id });

      if (response.status === "ok") {
        onNotice({ tone: "ok", text: "Event deleted." });
        await onChanged();
      } else {
        onNotice({ tone: "error", text: "Event could not be deleted." });
      }
    } catch (error) {
      onNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="rounded-[8px] border border-line bg-surface p-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-serif text-xl font-semibold">{event.name}</h3>
            <StatusBadge status={event.status} />
          </div>
          <p className="mt-1 text-sm text-muted">
            {formatDate(event.date)} · {participants} participant
            {participants === 1 ? "" : "s"}
            {event.expiry_date ? ` · closes ${formatDate(event.expiry_date)}` : ""}
          </p>
        </div>
      </header>

      <dl className="mt-4 grid grid-cols-3 gap-3 text-center">
        <Stat label="Searches" value={event.searches} />
        <Stat label="Downloads" value={event.downloads} />
        <Stat label="Not found" value={event.not_found} />
      </dl>

      {event.categories.length > 0 ? (
        <ul className="mt-4 flex flex-wrap gap-2">
          {event.categories.map((category) => (
            <li
              key={category.id}
              className="rounded-full border border-line bg-surface-muted px-3 py-1 text-xs text-muted"
            >
              {category.label}: {category.participant_count}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-4 text-sm text-danger">
          This event has no category yet. Add one before publishing.
        </p>
      )}

      {primaryCategory ? (
        <ParticipantPanel
          event={event}
          categoryId={primaryCategory}
          salt={salt}
          editKeyHash={editKeyHash}
          onChanged={onChanged}
          onNotice={onNotice}
        />
      ) : null}

      <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4">
        {event.status === "live" ? (
          <button
            type="button"
            onClick={() => void changeStatus("paused")}
            disabled={busy}
            className={buttonClasses({ variant: "secondary", size: "sm" })}
          >
            Pause
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void changeStatus("live")}
            disabled={busy}
            className={buttonClasses({ variant: "primary", size: "sm" })}
          >
            <Check className="size-4" aria-hidden="true" />
            {event.status === "paused" ? "Resume" : "Publish"}
          </button>
        )}

        <button
          type="button"
          onClick={() => void extend()}
          disabled={busy}
          className={buttonClasses({ variant: "secondary", size: "sm" })}
        >
          Extend 30 days
        </button>

        <button
          type="button"
          onClick={() => void remove()}
          disabled={busy}
          className={buttonClasses({ variant: "destructive", size: "sm" })}
        >
          Delete
        </button>
      </div>
    </article>
  );
}

function ParticipantPanel({
  event,
  categoryId,
  salt,
  editKeyHash,
  onChanged,
  onNotice,
}: {
  event: DashboardEvent;
  categoryId: string;
  salt: string;
  editKeyHash: string;
  onChanged: () => Promise<void>;
  onNotice: (notice: Notice) => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);

  const add = async () => {
    if (saving) return;

    const lines = text
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (lines.length === 0) {
      onNotice({ tone: "error", text: "Paste at least one name." });
      return;
    }

    if (lines.length > 5000) {
      onNotice({ tone: "error", text: "Add at most 5,000 names at a time." });
      return;
    }

    setSaving(true);

    try {
      const rows: ParticipantRow[] = [];

      for (const line of lines) {
        const [rawName, rawPosition] = line.split(",");

        if (!rawName?.trim()) continue;

        rows.push({
          name_hash: await hashName(salt, rawName.trim()),
          category_id: categoryId,
          identifier_hash: null,
          position_text: rawPosition?.trim() || null,
          duplicate_flag: false,
        });
      }

      const response = await addParticipants({
        editKeyHash,
        eventId: event.id,
        rows,
      });

      if (response.status === "ok") {
        setText("");
        onNotice({
          tone: "ok",
          text:
            response.skipped > 0
              ? `Added ${response.inserted}. Skipped ${response.skipped} duplicate or invalid row${response.skipped === 1 ? "" : "s"}.`
              : `Added ${response.inserted} participant${response.inserted === 1 ? "" : "s"}.`,
        });
        await onChanged();
      } else if (response.status === "error") {
        onNotice({ tone: "error", text: participantMessage(response.code) });
      } else {
        onNotice({ tone: "error", text: "Your session expired. Please log in again." });
      }
    } catch (error) {
      onNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  const clear = async () => {
    const answer = window.prompt(
      `Type CLEAR to remove every participant from "${event.name}".`,
    );

    if (answer !== "CLEAR") return;

    setSaving(true);

    try {
      const response = await clearParticipants({ editKeyHash, eventId: event.id });

      if (response.status === "ok") {
        onNotice({ tone: "ok", text: "Participant list cleared." });
        await onChanged();
      } else {
        onNotice({ tone: "error", text: "Could not clear the list." });
      }
    } catch (error) {
      onNotice({ tone: "error", text: errorMessage(error) });
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="mt-4 rounded-[8px] border border-line bg-surface-muted p-4">
      <summary className="cursor-pointer text-sm font-medium text-ink">
        Add participants
      </summary>

      <p className="mt-3 text-sm text-muted">
        One person per line. Add a comma and the position text if you want it printed, for
        example <code className="font-mono text-xs">Aashay Chahande, Winner</code>.
      </p>

      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        rows={5}
        placeholder={"Aashay Chahande, Winner\nRiya Sharma, Participant"}
        className="mt-3 w-full rounded-md border border-line bg-surface px-3 py-2 font-mono text-sm text-ink placeholder:text-muted"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void add()}
          disabled={saving}
          className={buttonClasses({ variant: "primary", size: "sm" })}
        >
          {saving ? "Saving…" : "Add names"}
        </button>
        <button
          type="button"
          onClick={() => void clear()}
          disabled={saving}
          className={buttonClasses({ variant: "ghost", size: "sm" })}
        >
          Clear list
        </button>
      </div>
    </details>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border border-line bg-surface-muted px-2 py-3">
      <dt className="text-xs uppercase tracking-[0.08em] text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold text-ink">{value}</dd>
    </div>
  );
}

function StatusBadge({ status }: { status: DashboardEvent["status"] }) {
  const tones: Record<DashboardEvent["status"], string> = {
    draft: "border-line text-muted",
    live: "border-accent bg-accent-soft text-accent",
    paused: "border-line-strong text-ink-soft",
    expired: "border-danger text-danger",
  };

  return (
    <span
      className={`rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${tones[status]}`}
    >
      {status}
    </span>
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

function expiryInDays(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);

  return date.toISOString().slice(0, 10);
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "Something went wrong. Please try again.";
}

function statusMessage(code: string): string {
  switch (code) {
    case "no_participants":
      return "Add at least one participant before publishing.";
    case "expiry_required":
      return "Set an expiry date in the future before publishing.";
    case "event_not_found":
      return "That event no longer exists.";
    default:
      return "That change was not saved.";
  }
}

function participantMessage(code: string): string {
  switch (code) {
    case "participant_limit_reached":
      return "This event already has the maximum of 5,000 participants.";
    case "invalid_category":
      return "That category does not belong to this event.";
    case "event_not_found":
      return "That event no longer exists.";
    default:
      return "The list was not saved. Nothing was changed.";
  }
}
