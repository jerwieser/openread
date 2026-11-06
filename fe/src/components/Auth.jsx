// The pieces the account pages share: the page they sit on, where to go after logging in and the
// guard that sends logged-out readers from pages that need an account to the log-in page.
import { Link, Navigate, useLocation } from "react-router-dom";

import { useUser } from "../store.js";
import "./Auth.css";
import Logo from "./Logo.jsx";
import { usePageTitle } from "./PageHeader.jsx";

// Where to go after logging in: the ?next= page when it's one of ours, otherwise the fallback
export function nextPath(params, fallback = "/bookshelf") {
  const next = params.get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

// The page for logging in, signing up and resetting a password, after Bootstrap's sign-in example
// (getbootstrap.com/docs/5.3/examples/sign-in): one narrow column in the middle of a light grey
// page, the logo above the title. switchLink is the "New here? Sign up" line under the form.
export function AuthPage({ title, lead, switchLink, width = 330, children }) {
  usePageTitle(title);
  return (
    <div className="d-flex align-items-center py-4 min-vh-100">
      <main className="form-signin w-100 m-auto p-3" style={{ maxWidth: width }}>
        <Link to="/" className="d-inline-block mb-4" aria-label="OpenRead: home">
          <Logo size={56} />
        </Link>
        <h1 className="h3 mb-3 fw-normal">{title}</h1>
        {lead && <p className="text-body-secondary">{lead}</p>}
        {children}
        {switchLink && <p className="mt-4 mb-0">{switchLink}</p>}
        <p className="mt-5 mb-3 small text-body-secondary">
          © 2026 OpenRead
        </p>
      </main>
    </div>
  );
}

// Shows the page to a signed-in reader, and sends anyone else to the log-in page, which says why
// (the why line) and brings them back here once they've logged in
export function RequireLogin({ children: page, why }) {
  const user = useUser();
  const { pathname, search } = useLocation();
  if (user) return page;
  return <Navigate to={`/log-in?next=${encodeURIComponent(pathname + search)}`} state={{ why }} replace />;
}
