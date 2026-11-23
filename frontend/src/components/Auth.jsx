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

// Black and white photographs of reading, one per account page, so the form sits on a picture of
// what the app is for. public/backgrounds.
const SCENES = [
  ["/welcome/import", "/backgrounds/shelf.jpg"],
  ["/welcome", "/backgrounds/track.jpg"],
  ["/sign-up", "/backgrounds/track.jpg"],
  ["/log-in", "/backgrounds/reading.jpg"],
  ["/forgot-password", "/backgrounds/shelf.jpg"],
  ["/reset-password", "/backgrounds/open-book.jpg"],
  ["/verify-email", "/backgrounds/open-book.jpg"],
];

const sceneFor = (pathname) => SCENES.find(([path]) => pathname.startsWith(path))?.[1] ?? "/backgrounds/open-book.jpg";

// The page for logging in, signing up and resetting a password, after Bootstrap's sign-in example
// (getbootstrap.com/docs/5.3/examples/sign-in): one narrow column in the middle of the page, the
// logo and name above the title, as in the navbar. switchLink is the "New here? Sign up" line under the form.
export function AuthPage({ title, lead, switchLink, width = 330, children }) {
  usePageTitle(title);
  const { pathname } = useLocation();
  return (
    <div className="auth-scene d-flex align-items-center py-4 min-vh-100">
      <div className="auth-scene-photo" style={{ backgroundImage: `url(${sceneFor(pathname)})` }} aria-hidden="true" />
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
