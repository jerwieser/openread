import { Container } from "react-bootstrap";
import { useNavigate } from "react-router-dom";

import { RequireLogin } from "../components/Auth.jsx";
import ImportBooks from "../components/ImportBooks.jsx";
import PageHeader from "../components/PageHeader.jsx";

// Importing books from Goodreads or The StoryGraph after signing up, from Settings or an empty
// bookshelf: the same steps as when signing up (ImportBooks), in the site's own page
function Import() {
  const navigate = useNavigate();
  return (
    <Container className="py-5">
      <PageHeader title="Import your books">
        Bring the books you keep on Goodreads or The StoryGraph to your bookshelf here. You can do it again whenever
        you like.
      </PageHeader>
      <div className="mx-auto" style={{ maxWidth: "36rem" }}>
        <ImportBooks doneLabel="Go to your bookshelf" onDone={() => navigate("/bookshelf")} />
      </div>
    </Container>
  );
}

export default function ImportPage() {
  return (
    <RequireLogin why="Log in to import your books from Goodreads or The StoryGraph.">
      <Import />
    </RequireLogin>
  );
}
