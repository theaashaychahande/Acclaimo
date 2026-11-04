import { Link } from "react-router-dom";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";
import { buttonClasses } from "../components/ui/Button";
import { ArrowRight } from "../components/ui/Icons";

export function CreatePage() {
  return (
    <PageIntro
      eyebrow="Organizers"
      title="Create your organization"
      intro="This is where a department, club, or committee sets up its Acclaimo account. The form and edit key are being connected to the backend."
    >
      <NoticePanel
        title="The setup form is nearly ready."
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
        <p>Before you start, have two things ready:</p>
        <ul className="mt-3 space-y-2">
          <li>A participant list as CSV or Excel.</li>
          <li>A certificate design with an empty space for the name.</li>
        </ul>
        <p className="mt-4">Setup will take about ten minutes once the form is live.</p>
      </NoticePanel>
    </PageIntro>
  );
}
