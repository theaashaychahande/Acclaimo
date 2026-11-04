import { useParams } from "react-router-dom";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";

export function StudentPage() {
  const { linkId } = useParams();

  return (
    <PageIntro
      eyebrow="Student link"
      title="Find your certificate"
      intro="This is the page students open from WhatsApp. It will show the organization name, one name field, and their certificate."
    >
      <NoticePanel title="The lookup is being connected.">
        <p>
          The link ID <span className="font-mono text-sm text-ink">{linkId ?? "unknown"}</span> is
          valid, but participant records do not exist until an organizer publishes an event.
        </p>
        <p className="mt-4">
          In the finished flow, a student types the name they registered with, sees the right
          certificate for their category, and downloads it as a PDF or image.
        </p>
      </NoticePanel>
    </PageIntro>
  );
}
