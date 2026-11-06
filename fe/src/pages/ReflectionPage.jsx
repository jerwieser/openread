import { useState } from "react";
import { Alert, Button, Col, Container, Row } from "react-bootstrap";
import { Link, useNavigate, useParams } from "react-router-dom";

import BookCover from "../components/BookCover.jsx";
import BusyButton from "../components/BusyButton.jsx";
import { GridPlaceholder, Loader, ReflectionCardPlaceholder } from "../components/Loading.jsx";
import { useMessage } from "../components/Messages.jsx";
import { SectionHeader, usePageTitle } from "../components/PageHeader.jsx";
import ReflectionCard, { Byline } from "../components/ReflectionCard.jsx";
import { bookBySlug } from "../data/books.js";
import { toReflection, usePublishedReflections } from "../data/reflections.js";
import { useReflections } from "../store.js";
import NotFoundPage from "./NotFoundPage.jsx";

export default function ReflectionPage() {
  const { id } = useParams();
  const [own, , removeReflection] = useReflections();
  const navigate = useNavigate();
  const message = useMessage();
  const [deleting, setDeleting] = useState(false);
  const published = usePublishedReflections();
  // the reader's own, drafts included, then everyone's published ones
  const mine = own.find((r) => r.id === id);
  const reflection = mine ? toReflection(mine) : published.find((r) => r.id === id);
  usePageTitle(reflection?.title);
  if (!reflection) return <NotFoundPage />;

  const book = bookBySlug(reflection.book);
  const more = published.filter((r) => r.book === reflection.book && r.id !== reflection.id);
  // asks first, with the browser's own confirm dialog like the site's other deletions, then goes back
  // to the book's reflections
  const remove = async () => {
    if (!window.confirm(`Delete “${reflection.title}”?`)) return;
    setDeleting(true);
    try {
      await removeReflection(reflection.id);
    } catch (error) {
      setDeleting(false);
      message(error.message, "danger");
      return;
    }
    navigate(book ? `/books/${book.slug}#reflections` : "/");
    message(`${reflection.title} is deleted.`, "info");
  };

  return (
    <Container className="py-5">
      {/* one centred column, like the book page: the book and the title on top, then the essay in a
          narrower column that's comfortable to read, then where to read the book together */}
      <header className="text-center">
        {reflection.status === "draft" && (
          <Alert variant="light" className="border small mx-auto" style={{ maxWidth: "36rem" }}>
            This is a draft: only you can see it until you publish it.
          </Alert>
        )}
        {book && (
          <Link to={`/books/${book.slug}`} className="d-inline-block mb-4">
            <BookCover book={book} size="lg" />
          </Link>
        )}
        {book && (
          <p className="text-body-secondary mb-2">
            A reflection on <Link to={`/books/${book.slug}`}><i>{book.title}</i></Link> by {book.author}
          </p>
        )}
        <h1 className="display-4 fw-bold text-body-emphasis mb-3">{reflection.title}</h1>
        <Byline reflection={reflection} className="justify-content-center" />
        {reflection.own && (
          <div className="d-flex justify-content-center gap-2 mt-3">
            <Button as={Link} to={`/reflections/${reflection.id}/edit`} variant="outline-primary" size="sm">
              Edit reflection
            </Button>
            <BusyButton variant="outline-danger" size="sm" onClick={remove} busy={deleting} busyText="Deleting…">
              Delete
            </BusyButton>
          </div>
        )}
      </header>

      <article className="mx-auto mt-5 pt-5 border-top" style={{ maxWidth: "40rem", fontSize: "1.125rem" }}>
        {reflection.paragraphs.map((p, i) => (
          <p key={i} className="lh-lg">
            {p}
          </p>
        ))}
      </article>

      {book && (
        <div className="text-center mt-5">
          <p className="fs-5 mb-3">
            Read <i>{book.title}</i> too
          </p>
          <Button as={Link} to={`/books/${book.slug}#readers`} size="lg" className="px-5">
            Talk to its readers
          </Button>
        </div>
      )}

      {more.length > 0 && (
        <section className="mt-5">
          <SectionHeader title={`More reflections on ${book.title}`} />
          <Loader key={reflection.id} fallback={<GridPlaceholder Item={ReflectionCardPlaceholder} count={Math.min(more.length, 2)} xs={1} lg={2} className="g-4 justify-content-center" />}>
            <Row xs={1} lg={2} className="g-4 justify-content-center">
              {more.map((r) => (
                <Col key={r.id}>
                  <ReflectionCard reflection={r} showBook={false} />
                </Col>
              ))}
            </Row>
          </Loader>
        </section>
      )}
    </Container>
  );
}
