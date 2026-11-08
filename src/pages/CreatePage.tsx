import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";
import { buttonClasses } from "../components/ui/Button";
import { ArrowRight, Check, Download } from "../components/ui/Icons";
import { createOrganization } from "../lib/api";
import { downloadBlob } from "../lib/certificate";
import { describeError } from "../lib/errors";
import { saveSession } from "../lib/session";
import {
  generateEditKey,
  generateLinkId,
  generateSalt,
  hashEditKey,
} from "../shared";

type CreatedOrganization = {
  editKey: string;
  editKeyHash: string;
  linkId: string;
  organizationName: string;
  departmentOrClub: string;
};

export function CreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: "",
    department: "",
    publicContact: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<CreatedOrganization | null>(null);
  const [savedKey, setSavedKey] = useState(false);
  const [copied, setCopied] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting) return;

    const name = form.name.trim();
    const department = form.department.trim();
    const publicContact = form.publicContact.trim();

    if (name.length < 2) {
      setError("Enter the organization name.");
      return;
    }
    if (department.length < 2) {
      setError("Enter the department or club name.");
      return;
    }
    if (publicContact.length > 200) {
      setError("Keep the public contact under 200 characters.");
      return;
    }

    setSubmitting(true);
    setError(null);

    const editKey = generateEditKey();
    const salt = generateSalt();
    const editKeyHash = await hashEditKey(editKey);

    // A collision here is vanishingly unlikely, but retrying costs nothing and
    // means a student never ends up with a duplicate link.
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const linkId = generateLinkId();

      try {
        const response = await createOrganization({
          name,
          departmentOrClub: department,
          publicContact: publicContact || null,
          linkId,
          salt,
          editKeyHash,
        });

        if (response.status === "ok") {
          setCreated({
            editKey,
            editKeyHash,
            linkId,
            organizationName: name,
            departmentOrClub: department,
          });
          setSubmitting(false);
          return;
        }

        if (response.status === "rate_limited") {
          setError(
            `Too many organizations created from this device. Try again in ${response.retry_after_seconds} seconds.`,
          );
          setSubmitting(false);
          return;
        }

        if (response.code === "link_id_taken" || response.code === "edit_key_taken") {
          continue;
        }

        setError(
          "Your organization was not created. Nothing was changed. Please try again.",
        );
        setSubmitting(false);
        return;
      } catch (caught) {
        setError(
          describeError(
            caught,
            "Your organization was not created. Nothing was changed.",
          ),
        );
        setSubmitting(false);
        return;
      }
    }

    setError("We could not find an unused link. Please try again.");
    setSubmitting(false);
  };

  const copyKey = async () => {
    if (!created) return;

    try {
      await navigator.clipboard.writeText(created.editKey);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      const field = document.getElementById("edit-key") as HTMLInputElement | null;
      field?.select();
      setError("Copy is blocked here. Select the key and copy it manually.");
    }
  };

  const downloadKey = () => {
    if (!created) return;

    const link = `${window.location.origin}/o/${created.linkId}`;
    const body = [
      "Acclaimo edit key",
      "",
      `Organization: ${created.organizationName}`,
      `Department or club: ${created.departmentOrClub}`,
      `Student link: ${link}`,
      "",
      `Edit key: ${created.editKey}`,
      "",
      "This key is shown only once. Keep this file private.",
      "Anyone with this key can manage your events.",
    ].join("\n");

    downloadBlob(new Blob([body], { type: "text/plain" }), "acclaimo-edit-key.txt");
  };

  const continueToDashboard = () => {
    if (!created || !savedKey) return;

    saveSession({
      editKeyHash: created.editKeyHash,
      linkId: created.linkId,
      organizationName: created.organizationName,
      departmentOrClub: created.departmentOrClub,
    });

    navigate("/dashboard", { replace: true });
  };

  if (created) {
    return (
      <PageIntro
        eyebrow="One last step"
        title="Save your edit key"
        intro="This key is the only way back into your organization. We cannot email it or reset it for you."
      >
        <NoticePanel title="Write it down before you continue.">
          <div className="space-y-4">
            <div>
              <label htmlFor="edit-key" className="block text-sm font-medium text-ink">
                Your edit key
              </label>
              <input
                id="edit-key"
                readOnly
                value={created.editKey}
                onFocus={(event) => event.currentTarget.select()}
                className="mt-2 w-full rounded-md border border-line bg-surface-muted px-3 py-3 font-mono text-base tracking-wide text-ink"
              />
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void copyKey()}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                {copied ? "Copied" : "Copy key"}
              </button>
              <button
                type="button"
                onClick={downloadKey}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                <Download className="size-4" aria-hidden="true" />
                Download as text
              </button>
            </div>

            <div className="rounded-[8px] border border-line bg-surface-muted p-4 text-sm">
              <p className="font-medium text-ink">Your student link</p>
              <p className="mt-1 break-all font-mono text-xs text-muted">
                {window.location.origin}/o/{created.linkId}
              </p>
            </div>

            <label className="flex items-start gap-3 text-sm text-ink">
              <input
                type="checkbox"
                checked={savedKey}
                onChange={(event) => setSavedKey(event.target.checked)}
                className="mt-1 size-4"
              />
              <span>I saved my edit key somewhere safe.</span>
            </label>

            {error ? <p className="text-sm text-danger">{error}</p> : null}

            <button
              type="button"
              onClick={continueToDashboard}
              disabled={!savedKey}
              className={buttonClasses({ variant: "primary", size: "lg" })}
            >
              <Check className="size-4" aria-hidden="true" />
              Continue to dashboard
            </button>
          </div>
        </NoticePanel>
      </PageIntro>
    );
  }

  return (
    <PageIntro
      eyebrow="Organizers"
      title="Create your organization"
      intro="A department, club, or committee sets up one Acclaimo account and shares a single link with students."
    >
      <NoticePanel
        title="Start with the basics."
        action={
          <>
            <Link to="/" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Back to home
            </Link>
            <Link to="/#how-it-works" className={buttonClasses({ variant: "ghost", size: "sm" })}>
              See how it works
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} className="max-w-md space-y-4" noValidate>
          <div>
            <label htmlFor="org-name" className="block text-sm font-medium text-ink">
              Organization name
            </label>
            <input
              id="org-name"
              value={form.name}
              onChange={(event) =>
                setForm((current) => ({ ...current, name: event.target.value }))
              }
              placeholder="e.g. Computer Science Department"
              autoComplete="organization"
              required
              maxLength={120}
              className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted"
            />
          </div>

          <div>
            <label htmlFor="org-department" className="block text-sm font-medium text-ink">
              Department or club
            </label>
            <input
              id="org-department"
              value={form.department}
              onChange={(event) =>
                setForm((current) => ({ ...current, department: event.target.value }))
              }
              placeholder="e.g. Mechanical Engineering Students' Association"
              required
              maxLength={120}
              className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted"
            />
          </div>

          <div>
            <label htmlFor="org-contact" className="block text-sm font-medium text-ink">
              Public contact <span className="font-normal text-muted">(optional)</span>
            </label>
            <input
              id="org-contact"
              value={form.publicContact}
              onChange={(event) =>
                setForm((current) => ({ ...current, publicContact: event.target.value }))
              }
              placeholder="e.g. mech-association@college.edu"
              maxLength={200}
              className="mt-2 w-full rounded-md border border-line bg-surface px-3 py-2.5 text-base text-ink placeholder:text-muted"
            />
            <p className="mt-2 text-sm text-muted">
              Shown to students when they cannot find their name.
            </p>
          </div>

          {error ? <p className="text-sm text-danger">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className={buttonClasses({ variant: "primary", size: "lg" })}
          >
            {submitting ? "Creating your organization…" : "Create organization"}
          </button>

          <p className="text-sm text-muted">
            Already have an edit key?{" "}
            <Link to="/login" className="underline">
              Organizer login
            </Link>
          </p>
        </form>
      </NoticePanel>
    </PageIntro>
  );
}
