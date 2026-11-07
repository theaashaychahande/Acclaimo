import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";
import { supabase } from "../lib/supabaseClient";

export function StudentPage() {
  const { linkId } = useParams();
  const [name, setName] = useState("");
  const [result, setResult] = useState<"idle" | "loading" | "found" | "notFound">("idle");
  const [category, setCategory] = useState<string | null>(null);
  const [positionText, setPositionText] = useState<string | null>(null);
  const [eventName, setEventName] = useState<string | null>(null);

  useEffect(() => {
    // placeholder: connect to API with linkId and name later
  }, [linkId, name]);

  useEffect(() => {
    // Trigger lookup when name changes
    if (name.trim().length >= 2) {
      lookup();
    }
  }, [name]);

  const lookup = async () => {
    if (name.trim().length < 2) return;
    setResult("loading");
    setCategory(null);
    setPositionText(null);
    setEventName(null);
    const text = name.normalize("NFC").trim().toLowerCase().replace(/[^a-zA-Z\s]/g, "");
    const hash = btoa(text);
    const { data, error } = await supabase.rpc("lookup", {
      p_link_id: linkId,
      p_name_hash: hash,
    });
    if (error) {
      setResult("notFound");
      console.error("Lookup error:", error);
      return;
    }
    if (data) {
      const resultStatus = (data as any).status;
      if (resultStatus === "ok" && (data as any).matches && (data as any).matches.length > 0) {
        const match = (data as any).matches[0];
        setResult("found");
        setCategory(match.category);
        setPositionText(match.extra_text);
        setEventName(match.event_name);
      } else {
        setResult("notFound");
      }
    } else {
      setResult("notFound");
    }
  };

  return (
    <PageIntro
      eyebrow="Student"
      title="Enter your name"
      intro="Type your full name as it appears on the certificate."
    >
      <NoticePanel title="Enter your name">
        {result === "loading" && <p>Searching...</p>}
        {result === "found" && (
          <div className="mt-4">
            <h3 className="font-medium mb-2">
              {eventName} — {category}
            </h3>
            <p className="text-sm text-muted-foreground">
              {positionText || ""}
            </p>
            <button>Download Certificate</button>
          </div>
        )}
        {result === "notFound" && (
          <p className="mt-2 text-warning">
            Name not found. Check spelling or try the name as it appears on your registration.
          </p>
        )}
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