import { useNavigate } from "react-router-dom";
import { NoticePanel, PageIntro } from "../components/layout/PageIntro";
import { buttonClasses } from "../components/ui/Button";

export function DashboardPage() {
  const navigate = useNavigate();

  const events = [
    {
      id: 1,
      name: "Spring Gala",
      date: "May 15, 2026",
      participants: 42,
      category: "Winner",
    },
    {
      id: 2,
      name: "Fall Conference",
      date: "Oct 10, 2026",
      participants: 15,
      category: "Participant",
    },
  ];

  return (
    <PageIntro
      eyebrow="Organizer dashboard"
      title="Your events"
      intro="Events, participant counts, and share links will live here."
    >
      <NoticePanel
        title="No events yet."
        action={
          <button
            onClick={() => navigate("/create")}
            className={buttonClasses({
              variant: "primary",
              size: "sm",
            })}
          >
            Create your first event
          </button>
        }
      >
        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground mt-4">
            No events yet. Create one to get started.
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {events.map((event) => (
              <li key={event.id} className="flex items-center justify-between p-3 rounded bg-card">
                <div>
                  <strong>{event.name}</strong>
                  <div className="text-xs text-muted-foreground">
                    {event.date} · {event.participants} participants
                  </div>
                </div>
                <span>{event.category}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-6 p-4 bg-surface rounded">
          <h3 className="font-medium mb-2">Organization settings</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Your organization details are managed through the platform.
          </p>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                Organization name
              </label>
              <input
                value="Acclaimo Organization"
                className="disabled:cursor-not-allowed disabled:opacity-50"
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Department or club
              </label>
              <input
                value="Department"
                className="disabled:cursor-not-allowed disabled:opacity-50"
                readOnly
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">
                Public contact
              </label>
              <input
                value="contact@example.com"
                className="disabled:cursor-not-allowed disabled:opacity-50"
                readOnly
              />
            </div>

            <button
              onClick={() => notify({ title: "Edit organization", variant: "info" })}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Edit organization details
            </button>
          </div>

          <div className="mt-6 pt-6 border-t">
            <h3 className="font-medium mb-3">Security</h3>

            <p className="text-sm text-muted-foreground mb-4">
              Your edit key is the only way to access your organization. Never share it.
            </p>

            <button
              onClick={() => notify({ title: "Regenerate key", variant: "info" })}
              className={buttonClasses({ variant: "secondary", size: "sm" })}
            >
              Regenerate edit key
            </button>

            <button
              onClick={() => notify({ title: "Delete organization", variant: "destructive" })}
              className={buttonClasses({ variant: "destructive" })}
            >
              Delete organization
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 mt-6">
          {events.map((event) => (
            <div
              key={event.id}
              className="p-4 rounded-lg border bg-card hover:bg-muted transition-colors"
            >
              <h3 className="font-medium mb-2">{event.name}</h3>
              <p className="text-sm text-muted-foreground">
                {event.date} · {event.participants} participants · {event.category}
              </p>
              <button
                onClick={() => notify({ title: "View event", variant: "info" })}
                className={buttonClasses({ variant: "secondary", size: "sm" })}
              >
                View
              </button>
            </div>
          ))}
        </div>
      </NoticePanel>
    </PageIntro>
  );
}

function notify({ title, variant }: { title: string; variant: "info" | "destructive" }) {
  // Simple inline notification - in production would use a toast component
  const el = document.createElement("div");
  el.className = `fixed top-4 right-4 px-4 py-2 rounded text-white ${
    variant === "destructive" ? "bg-danger" : "bg-accent"
  }`;
  el.textContent = title;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3000);
  return null;
}