import { Suspense, useEffect } from "react";
import { Navigate, Outlet, Route, Routes, useLocation } from "react-router-dom";

import { AskQuestionProvider } from "./components/AskQuestion.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { LoadingSpinner, lazyPage } from "./components/Loading.jsx";
import { MessageArea, MessagesProvider } from "./components/Messages.jsx";
import SiteFooter from "./components/SiteFooter.jsx";
import SiteNav from "./components/SiteNav.jsx";
import { useCatalogue, useUser } from "./store.js";

// Every page is its own chunk of code, fetched the first time it's opened (see Loading.jsx)
const AccountPage = lazyPage(() => import("./pages/AccountPage.jsx"));
const AdminPage = lazyPage(() => import("./pages/AdminPage.jsx"));
const BookPage = lazyPage(() => import("./pages/BookPage.jsx"));
const BooksPage = lazyPage(() => import("./pages/BooksPage.jsx"));
const BookshelfPage = lazyPage(() => import("./pages/BookshelfPage.jsx"));
const DiscoverPage = lazyPage(() => import("./pages/DiscoverPage.jsx"));
const ForgotPasswordPage = lazyPage(() => import("./pages/ForgotPasswordPage.jsx"));
const HomePage = lazyPage(() => import("./pages/HomePage.jsx"));
const ImportPage = lazyPage(() => import("./pages/ImportPage.jsx"));
const LogInPage = lazyPage(() => import("./pages/LogInPage.jsx"));
const MessagesPage = lazyPage(() => import("./pages/MessagesPage.jsx"));
const NotFoundPage = lazyPage(() => import("./pages/NotFoundPage.jsx"));
const PrivacyPage = lazyPage(() => import("./pages/LegalPages.jsx").then((m) => ({ default: m.PrivacyPage })));
const ReaderPage = lazyPage(() => import("./pages/ReaderPage.jsx"));
const ReflectionPage = lazyPage(() => import("./pages/ReflectionPage.jsx"));
const ResetPasswordPage = lazyPage(() => import("./pages/ResetPasswordPage.jsx"));
const SharedTrackPage = lazyPage(() => import("./pages/TrackPage.jsx").then((m) => ({ default: m.SharedTrackPage })));
const SignUpPage = lazyPage(() => import("./pages/SignUpPage.jsx"));
const SuggestBookPage = lazyPage(() => import("./pages/SuggestBookPage.jsx"));
const TermsPage = lazyPage(() => import("./pages/LegalPages.jsx").then((m) => ({ default: m.TermsPage })));
const TrackEditorPage = lazyPage(() => import("./pages/TrackEditorPage.jsx"));
const TrackPage = lazyPage(() => import("./pages/TrackPage.jsx"));
const VerifyEmailPage = lazyPage(() => import("./pages/VerifyEmailPage.jsx"));
const WelcomeImportPage = lazyPage(() => import("./pages/WelcomeImportPage.jsx"));
const WelcomePage = lazyPage(() => import("./pages/WelcomePage.jsx"));
const WriteReflectionPage = lazyPage(() => import("./pages/WriteReflectionPage.jsx"));

// A new page starts at the top, or at its #section, but changing a filter (same page, new ?query)
// doesn't jump. The section may still be loading, so look for it a few times before giving up.
function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return undefined;
    }
    let tries = 0;
    const timer = setInterval(() => {
      const target = document.getElementById(hash.slice(1));
      if (target) target.scrollIntoView();
      if (target || ++tries > 40) clearInterval(timer);
    }, 100);
    return () => clearInterval(timer);
  }, [pathname, hash]);
  return null;
}

// /tracks?tags=… to /discover?tags=…, keeping the search
function ToDiscover() {
  const { search } = useLocation();
  return <Navigate to={{ pathname: "/discover", search }} replace />;
}

// The pages that show while the catalogue is still coming: their words and pictures are their own,
// and the home page shows placeholders for what comes from the API (HomePage.jsx).
const OPENS_EARLY = new Set(["/", "/terms", "/privacy"]);

// What a reader who hasn't confirmed their email address yet can open. Anything else leads to
// /verify-email, which says what to do.
const OPEN_BEFORE_CONFIRMING = new Set(["/verify-email", "/reset-password", "/terms", "/privacy"]);

// A page, once the site has opened: while the catalogue loads (store.js, load) a spinner in its place,
// and if the API can't be reached, that. Most pages read the catalogue when their code is first run
// (the lists they make from it), so their code isn't even imported before; OPENS_EARLY's don't.
function Opened({ spinner, children }) {
  const catalogue = useCatalogue();
  const user = useUser();
  const { pathname } = useLocation();
  if (catalogue === "loading" && !OPENS_EARLY.has(pathname)) return spinner;
  if (user && !user.verified && !OPEN_BEFORE_CONFIRMING.has(pathname)) return <Navigate to="/verify-email" replace />;
  if (catalogue === "unreachable") {
    return (
      <div className="container py-5 text-center">
        <h1 className="h3">OpenRead can&apos;t be reached right now</h1>
        <p className="text-body-secondary">Try again in a minute.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Try again
        </button>
      </div>
    );
  }
  return children;
}

// The menu and the footer around every page except the account pages, which are full pages of their
// own. The menu and footer show straight away and stay put while the catalogue or a page's code
// loads, and the page fills at least the height of the window, so on a short page the footer is
// still at the bottom of the screen.
function SiteLayout() {
  const { pathname } = useLocation();
  const spinner = <LoadingSpinner label="Loading the page…" />;
  return (
    <div className="d-flex flex-column min-vh-100">
      <SiteNav />
      <main className="flex-grow-1">
        <ErrorBoundary resetKey={pathname}>
          <Opened spinner={spinner}>
            <Suspense fallback={spinner}>
              <Outlet />
            </Suspense>
          </Opened>
        </ErrorBoundary>
      </main>
      <SiteFooter />
    </div>
  );
}

// the account pages' own background while one loads
function AuthLayout() {
  const { pathname } = useLocation();
  const spinner = <div className="min-vh-100"><LoadingSpinner minHeight="100vh" /></div>;
  return (
    <ErrorBoundary resetKey={pathname}>
      <Opened spinner={spinner}>
        <Suspense fallback={spinner}>
          <Outlet />
        </Suspense>
      </Opened>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <MessagesProvider>
      <AskQuestionProvider>
        <ScrollToTop />
        {/* over every page, the account pages too */}
        <MessageArea />
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<HomePage />} />
            <Route path="/books" element={<BooksPage />} />
            <Route path="/books/suggest" element={<SuggestBookPage />} />
            <Route path="/books/:slug" element={<BookPage />} />
            <Route path="/discover" element={<DiscoverPage />} />
            {/* the tracks list became Discover; old links, searches included, land there */}
            <Route path="/tracks" element={<ToDiscover />} />
            <Route path="/tracks/new" element={<TrackEditorPage />} />
            <Route path="/tracks/shared" element={<SharedTrackPage />} />
            <Route path="/tracks/:id" element={<TrackPage />} />
            <Route path="/tracks/:id/edit" element={<TrackEditorPage />} />
            {/* meetups are gone for now; old links land on the tracks */}
            <Route path="/meetups/*" element={<Navigate to="/discover" replace />} />
            <Route path="/readers/:id" element={<ReaderPage />} />
            <Route path="/bookshelf" element={<BookshelfPage />} />
            <Route path="/my-reading" element={<Navigate to="/bookshelf" replace />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/messages/:id" element={<MessagesPage />} />
            <Route path="/reflections/new" element={<WriteReflectionPage />} />
            <Route path="/reflections/:id" element={<ReflectionPage />} />
            <Route path="/reflections/:id/edit" element={<WriteReflectionPage />} />
            <Route path="/account" element={<AccountPage />} />
            <Route path="/import" element={<ImportPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/privacy" element={<PrivacyPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>
          <Route element={<AuthLayout />}>
            <Route path="/log-in" element={<LogInPage />} />
            <Route path="/sign-up" element={<SignUpPage />} />
            <Route path="/welcome" element={<WelcomePage />} />
            <Route path="/welcome/import" element={<WelcomeImportPage />} />
            <Route path="/verify-email" element={<VerifyEmailPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
        </Routes>
      </AskQuestionProvider>
    </MessagesProvider>
  );
}
