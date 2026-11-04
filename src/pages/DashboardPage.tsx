import { Link } from "react-router-dom";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";
import { buttonClasses } from "../components/ui/Button";
import { Plus } from "../components/ui/Icons";

export function DashboardPage() {
  return (
    <PageIntro
      eyebrow="Organizer dashboard"
      title="Your events"
      intro="Events, participant counts, and share links will live here. The dashboard shell is part of the next build."
    >
      <NoticePanel
        title="No events yet."
        action={
          <Link to="/create" className={buttonClasses({ size: "sm" })}>
            <Plus className="size-4" />
            Create an event
          </Link>
        }
      >
        <p>
          An event holds one participant list and up to six certificate designs. Once setup is
          connected, you will be able to create one here and share its link.
        </p>
      </NoticePanel>
    </PageIntro>
  );
}
