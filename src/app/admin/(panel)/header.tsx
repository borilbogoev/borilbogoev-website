// Page header used by every admin page: logo mark, eyebrow, title and actions.
export function PageHeader({ eyebrow, title, actions }: { eyebrow: string; title: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <header className="bbfa-top">
      <div className="bbfa-top__title">
        <div className="bbfa-eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
      </div>
      {actions ? <div className="bbfa-top__actions">{actions}</div> : null}
    </header>
  );
}
