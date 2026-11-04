import { NoticePanel, PageIntro } from "../components/layout/PageIntro";

export function AdminPage() {
  return (
    <PageIntro
      eyebrow="Restricted"
      title="Admin"
      intro="Platform administration is not connected yet. This page will stay hidden and require an admin secret."
    >
      <NoticePanel title="No admin tools are available.">
        <p>
          When the backend is in place, this page will list organizations, their event and
          participant counts, and their status. It will never show participant names.
        </p>
      </NoticePanel>
    </PageIntro>
  );
}
