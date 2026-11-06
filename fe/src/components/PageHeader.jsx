import { useEffect } from "react";
import { Link } from "react-router-dom";

import Icon from "./Icon.jsx";

// The tab's title: "OR · " (short for OpenRead, so it fits in a narrow tab) and the page's own name,
// so every tab says whose it is (index.html has the home page's, for the first load). PageHeader and
// AuthPage set it from their heading; pages with a header of their own call it themselves. Nothing
// (null) leaves it to a page further in, like the not-found page a missing book shows.
export function usePageTitle(page) {
  useEffect(() => {
    if (page) document.title = `OR · ${page}`;
  }, [page]);
}

// The title block at the top of each inner page, centred like the home page's hero (Bootstrap's
// "centered hero"): a big bold display heading, a quieter grey lead paragraph in a narrower column,
// and the page's main buttons, if any, centred underneath. The contrast between the two says what to
// read first.
export default function PageHeader({ title, actions, children }) {
  usePageTitle(typeof title === "string" ? title : null);
  return (
    <header className="text-center pb-3 mb-5">
      <h1 className="display-4 fw-bold text-body-emphasis mb-3">{title}</h1>
      <div className="col-lg-6 mx-auto">
        {children && <p className="lead text-body-secondary mb-0">{children}</p>}
        {actions && <div className="d-grid gap-2 d-sm-flex justify-content-sm-center mt-4">{actions}</div>}
      </div>
    </header>
  );
}

// "Title + sub" above a row of cards, centred like the page header (Bootstrap's "centered hero"): a
// big bold display heading, a quieter grey lead paragraph in a narrower column, and the "see all"
// link or the section's button centred underneath.
export function SectionHeader({ title, link, children }) {
  return (
    <div className="text-center mb-5">
      <h2 className="display-5 fw-bold text-body-emphasis mb-3">{title}</h2>
      {children && (
        <div className="col-lg-6 mx-auto">
          <p className="lead text-body-secondary mb-0">{children}</p>
        </div>
      )}
      {link && <div className="mt-3">{link}</div>}
    </div>
  );
}

// A small grey aside under a page's main content, edged in blue: the why and how that help, but
// that nobody has to read first ("Why read it together", the tips beside a form)
export function Note({ title, className = "", children }) {
  return (
    <aside className={`small text-body-secondary text-start mx-auto mt-5 border-start border-3 border-primary ps-3 ${className}`} style={{ maxWidth: "36rem" }}>
      {title && <h2 className="h6 text-body-emphasis">{title}</h2>}
      {children}
    </aside>
  );
}

// the "All … →" link on the right of a section header, and the "Details →" on the home page's cards:
// Bootstrap's icon link, its arrow nudging right on hover
export function SeeAll({ to, className = "", style, children }) {
  return (
    <Link to={to} className={`icon-link icon-link-hover fw-medium text-decoration-none ${className}`} style={style}>
      {children}
      <Icon name="arrow-right" />
    </Link>
  );
}
