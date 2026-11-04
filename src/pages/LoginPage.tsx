import { Link } from "react-router-dom";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";
import { buttonClasses } from "../components/ui/Button";
import { ArrowRight } from "../components/ui/Icons";

export function LoginPage() {
  return (
    <PageIntro
      eyebrow="Organizers"
      title="Organizer login"
      intro="Returning organizers use the edit key they saved at sign-up. There is no email or password."
    >
      <NoticePanel
        title="Login is being connected."
        action={
          <Link to="/" className={buttonClasses({ variant: "secondary", size: "sm" })}>
            Back to home
            <ArrowRight className="size-4" />
          </Link>
        }
      >
        <p>
          When it is live, paste your edit key here to reach your events. Keep that key somewhere
          safe: it is shown only once, and it is the only way back into your dashboard.
        </p>
      </NoticePanel>
    </PageIntro>
  );
}
