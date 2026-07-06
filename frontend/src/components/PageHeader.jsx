export default function PageHeader({ eyebrow, title, description, actions, children, detail = false }) {
  return (
    <header className={`page-header${detail ? " page-header--detail" : ""}`}>
      <div className="page-header__content">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {children || <h1>{title}</h1>}
        {description && <p className="page-subtitle">{description}</p>}
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}
