// A book's quick look on Discover: what a reader needs to decide about it without leaving the page
// (the cover, who wrote it when, how hard it is, its categories) and the whole of what they can do
// with it there: put it on any shelf, save one of the tracks it's on. Then where to go next if it's
// not the one: more by the same author, and popular books like it, each opening here in its place.
// Its own page is a link away. Open while the URL has ?book=<slug>, so Back closes it.
import { Badge, Button, Modal, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";

import { DifficultyBadge } from "../../components/Badges.jsx";
import BookCover from "../../components/BookCover.jsx";
import BookStatusButton from "../../components/BookStatus.jsx";
import Icon from "../../components/Icon.jsx";
import { modalManager } from "../../components/modalManager.js";
import { OnYourTracks, SaveTrackButton } from "../../components/TrackFollow.jsx";
import { TrackShelf } from "../../components/TrackCard.jsx";
import { eraById, formatYear, useBook, usePagedBooks } from "../../data/books.js";
import { CATEGORIES } from "../../data/catalogue.js";
import { tracksFor } from "../../data/tracks.js";

const categoryLabel = (id) => CATEGORIES.find((c) => c.id === id)?.label;

// a row of small covers that scrolls sideways, each opening that book here instead
function BookStrip({ books, onOpen }) {
  return (
    <div className="discover-strip d-flex gap-3 overflow-x-auto pb-2">
      {books.map((b) => (
        <button key={b.slug} type="button" className="discover-strip-book btn p-0 border-0 text-start" onClick={() => onOpen(b)}>
          <BookCover book={b} size="sm" />
          <span className="d-block small fw-medium text-truncate mt-1" title={b.title}>
            {b.title}
          </span>
        </button>
      ))}
    </div>
  );
}

function Body({ book, onOpen, onClose }) {
  const authors = (book.authors ?? []).map((p) => p.slug).join(",");
  const byAuthor = usePagedBooks(authors ? { author: authors, sort: "popular" } : null, 13);
  const category = book.categories?.[0];
  const alike = usePagedBooks(category ? { category, sort: "popular" } : null, 13);
  const mine = byAuthor.books.filter((b) => b.slug !== book.slug).slice(0, 12);
  const mineSlugs = new Set(mine.map((b) => b.slug));
  const similar = alike.books.filter((b) => b.slug !== book.slug && !mineSlugs.has(b.slug)).slice(0, 12);
  const tracks = tracksFor(book);
  const era = eraById(book.era);

  return (
    <>
      <div className="d-flex flex-column flex-sm-row gap-4">
        <div className="flex-shrink-0 mx-auto mx-sm-0" style={{ width: 150 }}>
          <BookCover book={book} />
        </div>
        <div className="min-w-0">
          <h2 className="h3 fw-bold text-body-emphasis mb-1">{book.title}</h2>
          {book.originalTitle && book.originalTitle !== book.title && <p className="small text-body-secondary fst-italic mb-1">{book.originalTitle}</p>}
          <p className="fs-5 mb-2">{book.author}</p>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-3 small text-body-secondary">
            {book.year != null && <span>{formatYear(book)}</span>}
            {era && <span>· {era.label}</span>}
            <DifficultyBadge level={book.difficulty} labelled />
            {(book.categories ?? []).map((c) =>
              categoryLabel(c) ? (
                <Badge key={c} pill bg="body-tertiary" text="body-secondary" className="fw-medium border">
                  {categoryLabel(c)}
                </Badge>
              ) : null,
            )}
          </div>
          {/* the one main action: every shelf, as on the book's page */}
          <div className="d-flex flex-wrap align-items-center gap-2">
            <BookStatusButton book={book} />
            <Button as={Link} to={`/books/${book.slug}`} variant="link" className="icon-link icon-link-hover text-decoration-none" onClick={onClose}>
              Open its page
              <Icon name="arrow-right" />
            </Button>
          </div>
          <OnYourTracks book={book} />
        </div>
      </div>

      {tracks.length > 0 && (
        <section className="mt-4">
          <h3 className="h6 fw-bold text-body-emphasis">
            <Icon name="signpost-split" className="text-success me-2" />
            On {tracks.length === 1 ? "a reading track" : `${tracks.length} reading tracks`}
          </h3>
          <ul className="list-unstyled d-grid gap-2 mb-0">
            {tracks.map((t) => (
              <li key={t.id} className="discover-track-line d-flex align-items-center gap-3 rounded-3 border bg-body p-2">
                <TrackShelf track={t} className="discover-track-line-shelf flex-shrink-0 rounded-2" />
                <div className="min-w-0 me-auto">
                  <Link to={`/tracks/${t.id}`} className="fw-semibold link-body-emphasis text-decoration-none d-block text-truncate" onClick={onClose}>
                    {t.title}
                  </Link>
                  <span className="small text-body-secondary d-block text-truncate">
                    Stop {t.books.findIndex((s) => s.book.slug === book.slug) + 1} of {t.books.length}
                    {t.tagline && ` · ${t.tagline}`}
                  </span>
                </div>
                <SaveTrackButton track={t} className="fs-5 me-2" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {mine.length > 0 && (
        <section className="mt-4">
          <h3 className="h6 fw-bold text-body-emphasis">More by {book.author}</h3>
          <BookStrip books={mine} onOpen={onOpen} />
        </section>
      )}

      {similar.length > 0 && (
        <section className="mt-4">
          <h3 className="h6 fw-bold text-body-emphasis">Popular in {categoryLabel(category)}</h3>
          <BookStrip books={similar} onOpen={onOpen} />
        </section>
      )}
    </>
  );
}

export default function BookQuickLook({ slug, onOpen, onClose }) {
  const book = useBook(slug ?? "");
  return (
    <Modal show={Boolean(slug)} onHide={onClose} size="lg" centered scrollable manager={modalManager} aria-label={book?.title ?? "A book"}>
      <Modal.Header closeButton className="border-0 pb-0" />
      <Modal.Body className="pt-0 px-4 pb-4">
        {book ? (
          <Body key={book.slug} book={book} onOpen={onOpen} onClose={onClose} />
        ) : book === null ? (
          <p className="text-center text-body-secondary py-5 mb-0">That book isn&apos;t on OpenRead.</p>
        ) : (
          <div className="text-center py-5">
            <Spinner animation="border" variant="primary" role="status">
              <span className="visually-hidden">Loading the book…</span>
            </Spinner>
          </div>
        )}
      </Modal.Body>
    </Modal>
  );
}
