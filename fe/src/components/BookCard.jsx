import { Card } from "react-bootstrap";
import { Link } from "react-router-dom";

import { formatYear } from "../data/books.js";
import { DifficultyBadge } from "./Badges.jsx";
import BookCover from "./BookCover.jsx";
import { BookStatusIcon } from "./BookStatus.jsx";
import { SeeAll } from "./PageHeader.jsx";

// The title and the author take one line each, in small type, a longer one cut short with "…" (the
// whole of it shows on hover), so every card is the same height and the row under them lines up on
// every card, whatever the book: the difficulty meter on the left and, on the right, the bookmark that
// puts it on Want to read, or the icon of where the reader is with it. The rest is done on its own page.
// showcase: on the home page, which shows OpenRead to newcomers, a "Details →" link instead of the
// bookmark.
const TITLE = { fontSize: "0.8125rem" };
const AUTHOR = { fontSize: "0.75rem" };

export default function BookCard({ book, showcase = false }) {
  return (
    <Card className="h-100 border-0 bg-transparent">
      <BookCover book={book} />
      <Card.Body className="px-0 pt-2 pb-0 d-flex flex-column">
        <Card.Title as="h3" className="fw-semibold lh-sm text-truncate mb-1" style={TITLE} title={book.title}>
          <Link to={`/books/${book.slug}`} className="stretched-link link-body-emphasis text-decoration-none">
            {book.title}
          </Link>
        </Card.Title>
        <Card.Text className="text-body-secondary text-truncate mb-2 lh-sm" style={AUTHOR} title={book.author}>
          {book.author}
          {book.year != null && ` · ${formatYear(book)}`}
        </Card.Text>
        <div className="d-flex flex-wrap align-items-center gap-2 mt-auto">
          <DifficultyBadge level={book.difficulty} />
          {/* above the title's stretched link, which otherwise covers the whole card */}
          {showcase ? (
            <SeeAll to={`/books/${book.slug}`} className="ms-auto position-relative small" style={{ zIndex: 2 }}>
              Details<span className="visually-hidden">: {book.title}</span>
            </SeeAll>
          ) : (
            <BookStatusIcon book={book} className="ms-auto position-relative" style={{ zIndex: 2 }} />
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
