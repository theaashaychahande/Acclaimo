import { useState } from "react";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";

export function StudentPage() {
  const [name, setName] = useState("");

  return (
    <PageIntro
      eyebrow="Student"
      title="Enter your name"
      intro="Type your full name as it appears on the certificate."
    >
      <NoticePanel title="Enter your name">
        <p>Type your name to see your certificate.</p>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Your full name"
          required
          className="w-full p-2 rounded border mt-2"
        />
      </NoticePanel>
    </PageIntro>
  );
}