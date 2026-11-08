import { useEffect, useState } from "react";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";
import { buttonClasses } from "../components/ui/Button";
import { ArrowRight, Check, LinkIcon, Shield } from "../components/ui/Icons";
import {
  adminDeleteOrganization,
  adminListOrganizations,
  adminRegenerateEditKey,
  adminSetOrganizationStatus,
  type AdminOrganization,
} from "../lib/api";
import { generateEditKey, hashEditKey } from "../shared";

type Notice = { tone: "ok" | "error"; text: string };

export function AdminPage() {
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [organizations, setOrganizations] = useState<AdminOrganization[]>([]);
  const [loading, setLoading] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [issuedKey, setIssuedKey] = useState<{
    organizationName: string;
    key: string;
  } | null>(null);

  useEffect(() => {
    if (retryAfter <= 0) return;

    const timer = window.setInterval(() => {
      setRetryAfter((current) => Math.max(0, current - 1));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [retryAfter]);

  useEffect(() => {
    if (!notice) return;

    const timer = window.setTimeout(() => setNotice(null), 6000);

    return () => window.clearTimeout(timer);
  }, [notice]);

  const load = async (value: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await adminListOrganizations(value);

      if (response.status === "ok") {
        setOrganizations(response.organizations);
        setUnlocked(true);
        return;
      }

      if (response.status === "rate_limited") {
        setRetryAfter(response.retry_after_seconds);
        setError(`Too many attempts. Try again in ${response.retry_after_seconds} seconds.`);
        return;
      }

      if (response.status === "invalid_secret") {
        setError("That secret did not work. If this is a fresh install, set it up first.");
        return;
      }

      setError("The admin check could not run. Try again.");
    } catch (caught) {
      setError(
        caught instanceof Error && caught.message
          ? caught.message
          : "The admin check could not run. Try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (loading || retryAfter > 0) return;

    const value = secret.trim();
    if (value.length < 16) {
      setError("Enter the admin secret. A long random value is required.");
      return;
    }

    void load(value);
  };

  const lock = () => {
    setSecret("");
    setUnlocked(false);
    setOrganizations([]);
    setIssuedKey(null);
    setError(null);
    setNotice(null);
  };

  const refresh = async () => {
    if (!unlocked) return;
    await load(secret.trim());
  };

  const handleError = (response: { status: string; retry_after_seconds?: number }) => {
    if (response.status === "rate_limited" && response.retry_after_seconds) {
      setRetryAfter(response.retry_after_seconds);
      return `Too many attempts. Try again in ${response.retry_after_seconds} seconds.`;
    }

    if (response.status === "invalid_secret") {
      lock();
      return "The admin session ended. Unlock again.";
    }

    return "That change could not be saved.";
  };

  const toggleStatus = async (organization: AdminOrganization) => {
    const next = organization.status === "active" ? "disabled" : "active";

    if (
      next === "disabled" &&
      !window.confirm(
        `Disable ${organization.name}? Students will see that the link is turned off until it is enabled again.`,
      )
    ) {
      return;
    }

    const response = await adminSetOrganizationStatus({
      secret: secret.trim(),
      organizationId: organization.id,
      status: next,
    });

    if (response.status === "ok") {
      setNotice({
        tone: "ok",
        text: next === "active" ? "Organization enabled." : "Organization disabled.",
      });
      await refresh();
    } else {
      setNotice({ tone: "error", text: handleError(response) });
    }
  };

  const remove = async (organization: AdminOrganization) => {
    const answer = window.prompt(
      `This permanently deletes ${organization.name}, every event, and every participant hash. Type DELETE to confirm.`,
    );

    if (answer !== "DELETE") return;

    const response = await adminDeleteOrganization({
      secret: secret.trim(),
      organizationId: organization.id,
    });

    if (response.status === "ok") {
      setNotice({ tone: "ok", text: "Organization deleted." });
      await refresh();
    } else {
      setNotice({ tone: "error", text: handleError(response) });
    }
  };

  const reissueKey = async (organization: AdminOrganization) => {
    const answer = window.prompt(
      `Issue a new edit key for ${organization.name}? The old key stops working immediately. Type REISSUE to confirm.`,
    );

    if (answer !== "REISSUE") return;

    const key = generateEditKey();
    const keyHash = await hashEditKey(key);

    const response = await adminRegenerateEditKey({
      secret: secret.trim(),
      organizationId: organization.id,
      newEditKeyHash: keyHash,
    });

    if (response.status === "ok") {
      setIssuedKey({ organizationName: organization.name, key });
      setNotice({ tone: "ok", text: "New edit key issued. Copy it now." });
      await refresh();
    } else {
      setNotice({ tone: "error", text: handleError(response) });
    }
  };

  if (!unlocked) {
    return (
      <PageIntro
        eyebrow="Restricted"
        title="Platform admin"
        intro="This page uses a separate admin secret. It never shows participant data."
      >
        <NoticePanel
          title="Unlock the console"
          action={
            <a
              href="https://github.com/theaashaychahande/Acclaimo/blob/main/docs/OPERATIONS.md"
              target="_blank"
              rel="noreferrer"
              className={buttonClasses({ variant: "ghost", size: "sm" })}
            >
              Setup notes
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          }
        >
          <form onSubmit={onSubmit} className="max-w-md space-y-4" noValidate>
            <div>
              <label htmlFor="admin-secret" className="block text-sm font-medium text-ink">
                Admin secret
              </label>
              <input
                id="admin-secret"
                type="password"
                value={secret}
                onChange={(event) => {
                  setSecret(event.target.value);
                  setError(null);
                }}
                autoComplete="off"
                spellCheck={false}
                required
                className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-3 font-mono text-base text-ink"
              />
              <p className="mt-2 text-sm text-muted">
                Kept in memory only. It is never saved to this browser.
              </p>
            </div>

            {error ? (
              <p className="text-sm text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={loading || retryAfter > 0}
              className={buttonClasses({ variant: "primary", size: "lg" })}
            >
              {retryAfter > 0
                ? `Try again in ${retryAfter}s`
                : loading
                  ? "Checking…"
                  : "Unlock"}
            </button>
          </form>

          <div className="mt-6 flex items-start gap-3 rounded-[8px] border border-line bg-surface-muted p-4 text-sm text-muted">
            <Shield className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              A fresh install has no admin secret. Create one in the database first; the steps are
              in the setup notes. Without it, every secret is rejected.
            </p>
          </div>
        </NoticePanel>
      </PageIntro>
    );
  }

  return (
    <PageIntro
      eyebrow="Restricted"
      title="Platform admin"
      intro="Organizations and counts only. Participant names are hashed and never shown here."
    >
      <div className="space-y-6">
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

        {issuedKey ? (
          <section className="rounded-[8px] border border-accent bg-accent-soft p-5">
            <h2 className="font-serif text-xl font-semibold">
              New key for {issuedKey.organizationName}
            </h2>
            <p className="mt-2 text-sm text-ink-soft">
              Send this to the organizer over a private channel. It is not shown again.
            </p>
            <input
              readOnly
              value={issuedKey.key}
              onFocus={(event) => event.currentTarget.select()}
              className="mt-3 w-full rounded-md border border-line bg-surface px-3 py-3 font-mono text-base text-ink"
            />
            <button
              type="button"
              onClick={() => setIssuedKey(null)}
              className={buttonClasses({ variant: "secondary", size: "sm", className: "mt-3" })}
            >
              <Check className="size-4" aria-hidden="true" />
              I copied it
            </button>
          </section>
        ) : null}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted">
            {organizations.length} organization{organizations.length === 1 ? "" : "s"}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={loading}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={lock}
              className={buttonClasses({ variant: "ghost", size: "sm" })}
            >
              Lock
            </button>
          </div>
        </div>

        {organizations.length === 0 ? (
          <NoticePanel title="No organizations yet.">
            <p>Organizations will appear here after an organizer creates one.</p>
          </NoticePanel>
        ) : (
          <div className="overflow-x-auto rounded-[8px] border border-line">
            <table className="w-full min-w-[56rem] border-collapse text-left text-sm">
              <thead className="bg-surface-muted text-xs uppercase tracking-[0.08em] text-muted">
                <tr>
                  <th className="px-4 py-3 font-medium">Organization</th>
                  <th className="px-4 py-3 font-medium">Events</th>
                  <th className="px-4 py-3 font-medium">Categories</th>
                  <th className="px-4 py-3 font-medium">Participants</th>
                  <th className="px-4 py-3 font-medium">Lookups</th>
                  <th className="px-4 py-3 font-medium">Not found</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {organizations.map((organization) => (
                  <tr key={organization.id} className="border-t border-line align-top">
                    <td className="px-4 py-3">
                      <p className="font-medium text-ink">{organization.name}</p>
                      <p className="mt-0.5 text-xs text-muted">
                        {organization.department_or_club}
                      </p>
                      <p className="mt-0.5 font-mono text-xs text-muted">
                        /o/{organization.link_id}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-ink-soft">{organization.event_count}</td>
                    <td className="px-4 py-3 text-ink-soft">{organization.category_count}</td>
                    <td className="px-4 py-3 text-ink-soft">{organization.participant_count}</td>
                    <td className="px-4 py-3 text-ink-soft">{organization.lookup_count}</td>
                    <td className="px-4 py-3 text-ink-soft">{organization.not_found_count}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${
                          organization.status === "active"
                            ? "border-accent bg-accent-soft text-accent"
                            : "border-danger text-danger"
                        }`}
                      >
                        {organization.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted">
                      {formatDate(organization.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void toggleStatus(organization)}
                          className={buttonClasses({ variant: "secondary", size: "sm" })}
                        >
                          {organization.status === "active" ? "Disable" : "Enable"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void reissueKey(organization)}
                          className={buttonClasses({ variant: "secondary", size: "sm" })}
                        >
                          <LinkIcon className="size-4" aria-hidden="true" />
                          New key
                        </button>
                        <button
                          type="button"
                          onClick={() => void remove(organization)}
                          className={buttonClasses({ variant: "destructive", size: "sm" })}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-sm text-muted">
          Disabling an organization turns off its student link immediately. Deleting removes its
          events and participant hashes; template files are cleaned up through Storage.
        </p>
      </div>
    </PageIntro>
  );
}

function formatDate(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}
