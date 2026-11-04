import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { buttonClasses } from "../ui/Button";
import { Close, Menu } from "../ui/Icons";
import { ThemeToggle } from "./ThemeToggle";
import { Wordmark } from "./Wordmark";
import { cn } from "../../lib/cn";

const navLinks = [
  { label: "How it works", to: "/#how-it-works" },
  { label: "Privacy", to: "/#privacy" },
  { label: "Help", to: "/help" },
];

export function SiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname, location.hash]);

  useEffect(() => {
    if (!menuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-paper">
      <div className="container-page flex h-[4.5rem] items-center justify-between gap-3">
        <Wordmark onClick={() => setMenuOpen(false)} />

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {navLinks.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="inline-flex min-h-11 items-center rounded-md px-3 text-sm text-ink-soft transition-colors hover:bg-surface-muted hover:text-ink"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <div className="hidden lg:block">
            <ThemeToggle />
          </div>
          <div className="hidden lg:block">
            <Link to="/login" className={buttonClasses({ variant: "ghost", size: "sm" })}>
              Organizer login
            </Link>
          </div>
          <Link
            to="/create"
            aria-label="Create your organization"
            className={cn(buttonClasses({ size: "sm" }), "px-3.5 sm:px-4")}
          >
            <span className="sm:hidden">Create</span>
            <span className="hidden sm:inline">Create your organization</span>
          </Link>
          <button
            type="button"
            className="grid size-11 place-items-center rounded-md border border-line text-ink transition-colors hover:bg-surface-muted lg:hidden"
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <Close className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div id="mobile-menu" className="border-t border-line bg-surface lg:hidden">
          <nav aria-label="Mobile" className="container-page flex flex-col py-3">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMenuOpen(false)}
                className="flex min-h-11 items-center rounded-md px-2 text-[0.95rem] text-ink-soft hover:bg-surface-muted hover:text-ink"
              >
                {link.label}
              </Link>
            ))}
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="flex min-h-11 items-center rounded-md px-2 text-[0.95rem] text-ink-soft hover:bg-surface-muted hover:text-ink"
            >
              Organizer login
            </Link>
            <div className="mt-2 flex items-center justify-between border-t border-line pt-3">
              <span className="px-2 text-sm text-muted">Appearance</span>
              <ThemeToggle />
            </div>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
