// The pieces the account pages share: the page they sit on, where to go after logging in and the
// guard that sends logged-out readers from pages that need an account to the log-in page.
import { Link, Navigate, useLocation } from "react-router-dom";

import { TRACKS_HOME, useUser } from "../store.js";
import "./Auth.css";
import { Brand } from "./Logo.jsx";
import { usePageTitle } from "./PageHeader.jsx";

// Where to go after logging in: the ?next= page when it's one of ours, otherwise the fallback
export function nextPath(params, fallback = TRACKS_HOME) {
  const next = params.get("next");
  return next && next.startsWith("/") && !next.startsWith("//") ? next : fallback;
}

// A repeating book motif on the dark, the same idea as the rest of the site. No fill of its own, so
// the page colour stays the ground. public/patterns.
const PATTERNS = [
  ["/welcome/import", "/patterns/stack.svg"],
  ["/welcome", "/patterns/spines.svg"],
  ["/sign-up", "/patterns/spines.svg"],
  ["/log-in", "/patterns/open-book.svg"],
  ["/forgot-password", "/patterns/stack.svg"],
  ["/reset-password", "/patterns/open-book.svg"],
  ["/verify-email", "/patterns/spines.svg"],
];

const patternFor = (pathname) => PATTERNS.find(([path]) => pathname.startsWith(path))?.[1] ?? "/patterns/open-book.svg";

// The page for logging in, signing up and resetting a password, after Bootstrap's sign-in example
// (getbootstrap.com/docs/5.3/examples/sign-in): one narrow column in the middle of the page, the
// logo and name above the title, as in the navbar. switchLink is the "New here? Sign up" line under the form.
export function AuthPage({ title, lead, switchLink, width = 330, children }) {
  usePageTitle(title);
  const { pathname } = useLocation();
  return (
    <div
      className="auth-scene d-flex align-items-center py-4 min-vh-100"
      style={{ "--auth-pattern": `url(${patternFor(pathname)})` }}
    >
      <main className="form-signin w-100 m-auto p-3" style={{ maxWidth: width }}>
        <Link to="/" className="d-inline-flex fs-4 fw-bold link-body-emphasis text-decoration-none mb-4">
          <Brand size={30} />
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
