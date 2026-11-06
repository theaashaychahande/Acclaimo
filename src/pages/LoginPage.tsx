import { useState } from "react";
import { Link } from "react-router-dom";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";
import { buttonClasses } from "../components/ui/Button";

export function LoginPage() {
  const [editKey, setEditKey] = useState<string>("");
  const [rateLimited, setRateLimited] = useState(false);
  const [retryAfter, setRetryAfter] = useState(0);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = editKey.trim().toUpperCase().replace(/\s-/g, "");
    // In production this would verify the edit key via Supabase RPC
    // For now, accept any non-empty key as valid
    if (trimmed.length >= 8 && trimmed.length <= 32) {
      // Simulate successful login - in production would call verify_edit_key RPC
      window.location.href = "/dashboard";
    } else {
      const newAttempts = (rateLimited ? 0 : 1) + 1;
      setRateLimited(newAttempts >= 8);
      if (newAttempts >= 8) {
        setRetryAfter(60);
      }
    }
  };

  if (rateLimited) {
    return (
      <PageIntro
        eyebrow="Organizers"
        title="Organizer login"
        intro="Returning organizers use the edit key they saved at sign-up. There is no email or password."
      >
        <NoticePanel
          title={"Too many failed attempts. Please wait " + retryAfter + " seconds."}
          action={
            <Link to="/" className={buttonClasses({ variant: "secondary", size: "sm" })}>
              Back to home
            </Link>
          }
        >
          <p>
            After 8 consecutive failed attempts, a 60-second wait is required. This is part of
            the rate-limiting policy to protect organizer accounts.
          </p>
        </NoticePanel>
      </PageIntro>
    );
  }

  return (
    <PageIntro
      eyebrow="Organizers"
      title="Organizer login"
      intro="Returning organizers use the edit key they saved at sign-up. There is no email or password."
    >
      <NoticePanel
        title="Paste your edit key below"
        action={
          <Link to="/" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Back to home
          </Link>
        }
      >
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <input
              value={editKey}
              onChange={(e) => setEditKey(e.target.value)}
              placeholder="e.g. ABCD-EFGH-JKMN-PQRS"
              required
              className="w-full p-2 rounded border"
            />
            <input
              type="checkbox"
              id="saveKey"
              defaultChecked
              className="margin-0"
              disabled
            />
            <label htmlFor="saveKey" className="block text-sm text-muted-foreground">
              I saved my edit key
            </label>
          </div>
          <button
            type="submit"
            className={buttonClasses({
              variant: "primary",
              size: "lg",
            })}
          >
            {rateLimited ? "Please wait..." : "Sign in"}
          </button>
        </form>

        {rateLimited && (
          <p className="mt-3 text-sm text-muted-foreground">
            You can try again in {retryAfter} second(s).
          </p>
        )}
      </NoticePanel>
    </PageIntro>
  );
}