import { useId, type HTMLAttributes, type ReactNode } from "react";

export function LoadingState({ label = "Carregando..." }: { label?: string }) {
  return (
    <div className="loading-state" role="status" aria-live="polite">
      <span className="loading-state__spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function Skeleton({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={["skeleton", className].filter(Boolean).join(" ")} aria-hidden="true" />;
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  const titleId = useId();

  return (
    <section className="feedback" aria-labelledby={titleId}>
      <h2 className="feedback__title" id={titleId}>{title}</h2>
      {description ? <p className="feedback__description">{description}</p> : null}
      {action ? <div className="feedback__action">{action}</div> : null}
    </section>
  );
}

export function ErrorState({
  title = "Não foi possível carregar estas informações",
  children,
}: {
  title?: string;
  children?: ReactNode;
}) {
  const titleId = useId();

  return (
    <section className="feedback feedback--error" role="alert" aria-labelledby={titleId}>
      <h2 className="feedback__title" id={titleId}>{title}</h2>
      {children ? <div className="feedback__description">{children}</div> : null}
    </section>
  );
}
