import { useEffect } from "react";
import {
  BrowserRouter,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";
import { SiteFooter } from "./components/layout/SiteFooter";
import { SiteHeader } from "./components/layout/SiteHeader";
import { LandingPage } from "./pages/LandingPage";
import { CreatePage } from "./pages/CreatePage";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { StudentPage } from "./pages/StudentPage";
import { AdminPage } from "./pages/AdminPage";
import { HelpPage } from "./pages/HelpPage";
import { PrivacyPage } from "./pages/PrivacyPage";
import { TermsPage } from "./pages/TermsPage";
import { DesignPage } from "./pages/DesignPage";
import { NotFoundPage } from "./pages/NotFoundPage";

function AppLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:border focus:border-line focus:bg-surface focus:px-4 focus:py-2 focus:text-sm"
      >
        Skip to content
      </a>
      <SiteHeader />
      <main id="main" tabIndex={-1} className="flex-1 focus:outline-none">
        <Outlet />
      </main>
      <SiteFooter />
    </div>
  );
}

const titles: Record<string, string> = {
  "/": "Acclaimo — Event certificates, one link",
  "/create": "Create your organization — Acclaimo",
  "/login": "Organizer login — Acclaimo",
  "/dashboard": "Your events — Acclaimo",
  "/admin": "Admin — Acclaimo",
  "/help": "Help — Acclaimo",
  "/privacy": "Privacy — Acclaimo",
  "/terms": "Terms — Acclaimo",
  "/design": "Design system — Acclaimo",
};

function RouteEffects() {
  const location = useLocation();

  useEffect(() => {
    document.title =
      titles[location.pathname] ??
      (location.pathname.startsWith("/o/") ? "Your certificate — Acclaimo" : "Page not found — Acclaimo");
  }, [location.pathname]);

  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (location.hash) {
      const target = document.getElementById(location.hash.slice(1));
      if (target) {
        const timer = window.setTimeout(() => {
          target.scrollIntoView({
            behavior: reduceMotion ? "auto" : "smooth",
            block: "start",
          });
        }, 0);
        return () => window.clearTimeout(timer);
      }
    }

    window.scrollTo({ top: 0, behavior: "auto" });
    document.getElementById("main")?.focus({ preventScroll: true });
  }, [location.pathname, location.hash]);

  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <RouteEffects />
      <Routes>
        <Route element={<AppLayout />}>
          <Route index element={<LandingPage />} />
          <Route path="create" element={<CreatePage />} />
          <Route path="login" element={<LoginPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="o/:linkId" element={<StudentPage />} />
          <Route path="admin" element={<AdminPage />} />
          <Route path="help" element={<HelpPage />} />
          <Route path="privacy" element={<PrivacyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="design" element={<DesignPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
