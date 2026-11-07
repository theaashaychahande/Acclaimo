import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";
import { supabase } from "../lib/supabaseClient";

export function OrganizationPage() {
  const { linkId } = useParams();
  const [orgName, setOrgName] = useState("");
  const [logo, setLogo] = useState<string | null>(null);
  const [contact, setContact] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Fetch organization details from Supabase
    setLoading(true);
    supabase
      .from("organizations")
      .select("*")
      .eq("link_id", linkId)
      .single()
      .then(({ data, error: supabaseError }) => {
        setLoading(false);
        if (supabaseError) {
          setError(supabaseError.message ?? "Failed to load organization");
          console.error("Error fetching organization:", supabaseError);
        } else if (data) {
          setOrgName(data.name);
          setLogo(data.logo_path);
          setContact(data.public_contact);
        }
      })
  }, [linkId]);

  return (
    <PageIntro
      eyebrow="Student link"
      title="Organization page"
    >
      <NoticePanel title="Organization page">
        {loading && <p>Loading organization...</p>}
        {error && <p className="mt-2 text-warning">{error}</p>}
        {!loading && !error && (
          <div>
            <p>Organization link: <span className="font-mono">{linkId}</span></p>
            {orgName && <p><strong>Organization:</strong> {orgName}</p>}
            {logo && <p>Logo: {logo}</p>}
            {contact && <p><strong>Contact:</strong> {contact}</p>}
            <p>Use the same name you gave when registering to find your certificate.</p>
          </div>
        )}
      </NoticePanel>
    </PageIntro>
  );
}