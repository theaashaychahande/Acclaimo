import { Link } from "react-router-dom";
import { Github } from "../ui/Icons";
import { Wordmark } from "./Wordmark";

const columns = [
  {
    title: "Product",
    links: [
      { label: "How it works", to: "/#how-it-works" },
      { label: "Create an organization", to: "/create" },
      { label: "Organizer login", to: "/login" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help", to: "/help" },
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className="container-page py-16 lg:py-24">
        <div className="grid gap-12 sm:grid-cols-2 lg:grid-cols-[1.6fr_1fr_1fr_1fr]">
          <div className="max-w-xs">
            <Wordmark />
            <p className="mt-4 text-sm leading-relaxed text-muted">
              One private link for event certificates. Built for college departments and clubs.
            </p>
          </div>

          {columns.map((column) => (
            <div key={column.title}>
              <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">
                {column.title}
              </h2>
              <ul className="mt-4 space-y-2">
                {column.links.map((link) => (
                  <li key={link.to}>
                    <Link
                      to={link.to}
                      className="inline-flex min-h-11 items-center text-sm text-ink-soft underline-offset-4 hover:text-accent hover:underline"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h2 className="text-xs font-semibold uppercase tracking-[0.14em] text-muted">Project</h2>
            <ul className="mt-4 space-y-2">
              <li>
                <a
                  href="https://github.com/theaashaychahande/Acclaimo"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 text-sm text-ink-soft underline-offset-4 hover:text-accent hover:underline"
                >
                  <Github className="size-4" />
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/theaashaychahande/Acclaimo/issues"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center text-sm text-ink-soft underline-offset-4 hover:text-accent hover:underline"
                >
                  Report an issue
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-4 border-t border-line pt-6 text-xs text-muted sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 Aashay Chahande. Acclaimo is free to use.</p>
          <p>Acclaimo distributes certificates. It does not verify identity.</p>
        </div>
      </div>
    </footer>
  );
}
