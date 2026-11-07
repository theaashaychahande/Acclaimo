import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";
import { buttonClasses } from "../components/ui/Button";
import { verifyEditKey } from "../lib/api";
import { normalizeEditKey } from "../shared";
import { hashEditKey } from "../shared";
import { saveSession } from "../lib/session";

export function LoginPage() {
  const navigate = useNavigate();
  const [editKey, setEditKey] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryAfter, setRetryAfter] = useState(0);

  useEffect(() => {
    if (retryAfter <= 0) return;

    const timer = window.setInterval(() => {
      setRetryAfter((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [retryAfter]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting || retryAfter > 0) return;

    const normalized = normalizeEditKey(editKey);

    if (normalized.length !== 32) {
      setError(
        "That key looks incomplete. It should be 32 characters, usually shown in groups of four.",
      );
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      const editKeyHash = await hashEditKey(editKey);
      const response = await verifyEditKey(editKeyHash);

      if (response.status === "ok") {
        saveSession({
          editKeyHash,
          linkId: response.organization.link_id,
          organizationName: response.organization.name,
          departmentOrClub: response.organization.department_or_club,
        });
        navigate("/dashboard", { replace: true });
        return;
      }

      if (response.status === "rate_limited") {
        setRetryAfter(response.retry_after_seconds);
        setError(
          `Too many attempts. Try again in ${response.retry_after_seconds} seconds.`,
        );
        return;
      }

      setError("That key did not work. Check for extra spaces and try again.");
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "We could not check that key right now. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const locked = retryAfter > 0;

  return (
    <PageIntro
      eyebrow="Organizers"
      title="Organizer login"
      intro="Returning organizers use the edit key they saved at sign-up. There is no email or password."
    >
      <NoticePanel
        title="Paste your edit key"
        action={
          <Link to="/" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Back to home
          </Link>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <div>
            <label htmlFor="edit-key" className="block text-sm font-medium text-ink">
              Edit key
            </label>
            <input
              id="edit-key"
              value={editKey}
              onChange={(event) => {
                setEditKey(event.target.value);
                setError(null);
              }}
              placeholder="ABCD-EFGH-JKMN-PQRS-…"
              autoComplete="off"
              spellCheck={false}
              required
              className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-3 font-mono text-base tracking-wide text-ink placeholder:text-muted"
            />
            <p className="mt-2 text-sm text-muted">
              Spaces, line breaks, and lowercase letters are fine.
            </p>
          </div>

          {error ? (
            <p className="text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={submitting || locked}
            className={buttonClasses({ variant: "primary", size: "lg" })}
          >
            {locked
              ? `Try again in ${retryAfter}s`
              : submitting
                ? "Checking your key…"
                : "Sign in"}
          </button>
        </form>

        <p className="mt-6 text-sm text-muted">
          Lost your key? Ask the platform admin to issue a new one. We cannot recover the old
          one because we only store its hash.
        </p>

        <p className="mt-3 text-sm text-muted">
          New here?{" "}
          <Link to="/create" className="underline">
            Create an organization
          </Link>
          .
        </p>
      </NoticePanel>
    </PageIntro>
  );
}
