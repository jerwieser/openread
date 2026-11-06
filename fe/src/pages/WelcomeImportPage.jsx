import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { AuthPage } from "../components/Auth.jsx";
import ImportBooks from "../components/ImportBooks.jsx";
import { useUser } from "../store.js";

// The step after the profile when signing up: bringing the reader's books over from Goodreads or
// The StoryGraph, so
// their bookshelf isn't empty on day one. It can be skipped, and done later from Settings (/import).
export default function WelcomeImportPage() {
  const user = useUser();
  const navigate = useNavigate();
  const { state } = useLocation();
  if (!user) return <Navigate to="/sign-up" replace />;
  const onward = () => navigate(state?.next ?? "/bookshelf");

  return (
    <AuthPage
      title="Bring your books along"
      lead="Already keep track of your reading on Goodreads or The StoryGraph? Bring it along: the books we have on OpenRead go straight onto your bookshelf, finished, being read or waiting to be read."
      width={560}
    >
      <ImportBooks doneLabel="Continue" onDone={onward} onSkip={onward} />
    </AuthPage>
  );
}
