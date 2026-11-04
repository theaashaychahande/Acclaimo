import type { ReactNode } from "react";

export function PageIntro({
  eyebrow,
  title,
  intro,
  children,
}: {
  eyebrow: string;
  title: string;
  intro?: string;
  children?: ReactNode;
}) {
  return (
    <div className="container-page py-16 lg:py-24">
      <div className="max-w-3xl">
        <p className="eyebrow">{eyebrow}</p>
        <h1 className="mt-4 font-serif text-title font-semibold text-balance">{title}</h1>
        {intro ? (
          <p className="mt-12 max-w-2xl text-[1.02rem] leading-relaxed text-muted">{intro}</p>
        ) : null}
      </div>
      {children ? <div className="mt-12">{children}</div> : null}
    </div>
  );
}

export function NoticePanel({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="max-w-2xl rounded-[8px] border border-line bg-surface p-6 sm:p-8">
      <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
        <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
        In progress
      </p>
      <h2 className="mt-4 font-serif text-2xl font-semibold">{title}</h2>
      <div className="mt-4 text-[0.95rem] leading-relaxed text-muted">{children}</div>
      {action ? <div className="mt-6 flex flex-wrap gap-4">{action}</div> : null}
    </div>
  );
}
