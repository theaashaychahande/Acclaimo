import { useState } from "react";
import { Link } from "react-router-dom";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";
import { buttonClasses } from "../components/ui/Button";
import { ArrowRight } from "../components/ui/Icons";

export function CreatePage() {
  const [form, setForm] = useState({
    name: "",
    department: "",
    publicContact: "",
  });
  const [editKey, setEditKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const generateEditKey = () => {
    const alphabet = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
    const raw = Array.from({ length: 32 }, () =>
      alphabet[Math.floor(Math.random() * alphabet.length)],
    ).join("");
    const groups = raw.match(/.{4}/g) ?? [];
    setEditKey(groups.join("-"));
    setShowKey(true);
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    const trimmedName = form.name.trim();
    const trimmedDepartment = form.department.trim();
    if (trimmedName.length < 2 || trimmedDepartment.length < 2) {
      setSubmitting(false);
      return;
    }
    generateEditKey();
    setSubmitting(false);
  };

  const buttonProps = {
    variant: "primary" as const,
    size: "lg" as const,
  };

  return (
    <PageIntro
      eyebrow="Organizers"
      title="Create your organization"
      intro="This is where a department, club, or committee sets up its Acclaimo account."
    >
      <NoticePanel
        title="Fill in the form to get started."
        action={
          <>
            <Link to="/" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Back to home
            </Link>
            <Link to="/#how-it-works" className={buttonClasses({ variant: "ghost", size: "sm" })}>
              See how it works
              <ArrowRight className="size-4" />
            </Link>
          </>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4 max-w-md">
          <div>
            <label className="block text-sm font-medium mb-1">
              Organization name
            </label>
            <input
              value={form.name}
              onChange={(e) =>
                setForm((f) => ({ ...f, name: e.target.value.trim() }))
              }
              placeholder="e.g. Computer Science Department"
              required
              className="w-full p-2 rounded border"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Department or club
            </label>
            <input
              value={form.department}
              onChange={(e) =>
                setForm((f) => ({ ...f, department: e.target.value.trim() }))
              }
              placeholder="e.g. Computer Science Club"
              required
              className="w-full p-2 rounded border"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">
              Public contact (optional)
            </label>
            <input
              value={form.publicContact}
              onChange={(e) =>
                setForm((f) => ({ ...f, publicContact: e.target.value.trim() }))
              }
              placeholder="e.g. cs-dept@college.edu"
              className="w-full p-2 rounded border"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className={buttonClasses({
              variant: buttonProps.variant,
              size: buttonProps.size,
            })}
          >
            {submitting ? "Creating..." : "Create organization"}
          </button>
        </form>

        {editKey && (
          <div className="mt-6 p-4 bg-surface rounded border">
            <h3 className="font-medium mb-2">Your edit key</h3>
            <p className="text-sm text-muted-foreground mb-3">
              This is your edit key. It is shown only once. Save it somewhere safe. Without it,
              you cannot manage your events.
            </p>
            <div className="flex gap-2">
              <input
                value={editKey}
                readOnly
                className={buttonClasses({ variant: "ghost", size: "sm" })}
                placeholder="Copy key"
              />
              <button
                onClick={() => navigator.clipboard.writeText(editKey)}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                Copy
              </button>
            </div>
            <button
              onClick={() => setShowKey(true)}
              className={buttonClasses({ variant: "ghost", size: "sm" })}
            >
              Download as text
            </button>

            {showKey && (
              <textarea
                readOnly
                className="w-full p-2 rounded mt-2 bg-background text-sm"
                rows={3}
              >
                {editKey}
              </textarea>
            )}
          </div>
        )}
      </NoticePanel>
    </PageIntro>
  );
}