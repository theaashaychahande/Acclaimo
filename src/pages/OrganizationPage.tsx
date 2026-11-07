import { useParams } from "react-router-dom";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";

export function OrganizationPage() {
  const { linkId } = useParams();

  return (
    <PageIntro
      eyebrow="Student link"
      title="Organization page"
    >
      <NoticePanel title="Organization page">
        <p>Organization link: <span className="font-mono">{linkId}</span></p>
        <p>No menus, no clutter, no trackers.</p>
        <p>Use the same name you gave when registering to find your certificate.</p>
      </NoticePanel>
    </PageIntro>
  );
}