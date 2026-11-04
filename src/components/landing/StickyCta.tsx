import { Link } from "react-router-dom";
import { buttonClasses } from "../ui/Button";

export function StickyCta({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface px-6 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4 md:hidden">
      <div className="mx-auto flex max-w-lg items-center gap-4">
        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] uppercase tracking-[0.1em] text-muted">Free for college events</p>
          <p className="truncate text-sm font-medium">Ready when you are.</p>
        </div>
        <Link to="/create" className={buttonClasses({ size: "sm" })}>
          Create
        </Link>
      </div>
    </div>
  );
}
