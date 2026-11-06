import { Card } from "react-bootstrap";
import { Link } from "react-router-dom";

import { bookBySlug } from "../data/books.js";
import { formatDate } from "../data/reflections.js";
import { useUser } from "../store.js";
import BookCover from "./BookCover.jsx";
import Icon from "./Icon.jsx";
import Initials from "./Initials.jsx";
import "./ReflectionCard.css";

// the band's colour for books without a cover, from the illustrations' palette
const BANDS = ["#2b3a67", "#e8705a", "#2f9e7a", "#3b6fe0", "#c7962f"];

function bandFor(title) {
  let hash = 0;
  for (const ch of title) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return BANDS[hash % BANDS.length];
}

// "(JL) Jonas Lind · 28 September 2026 · 2 min read", the name linking to their profile when they have one
export function Byline({ reflection: r, className = "" }) {
  const user = useUser();
  return (
    <div className={`small text-body-secondary d-flex flex-wrap align-items-center gap-2 ${className}`}>
      <Initials name={r.author} photo={r.own ? user?.photo : r.reader?.photo} size={28} />
      {r.reader ? (
        // above a card's stretched link, so the name goes to the profile, not the reflection
        <Link to={`/readers/${r.reader.id}`} className="fw-medium link-body-emphasis position-relative" style={{ zIndex: 2 }}>
          {r.author}
        </Link>
      ) : (
        <span className="fw-medium text-body">{r.author}</span>
      )}
      <span>
        {formatDate(r.date)} · {r.minutes} min read
      </span>
    </div>
  );
}

// the opening of the first paragraph, cut at a word
function excerpt(paragraphs, length = 220) {
  const first = paragraphs[0] ?? "";
  return first.length <= length ? first : `${first.slice(0, first.lastIndexOf(" ", length))}…`;
}

// A reflection as a card: a band coloured by the book's own cover, blurred, with the title on it
// (and the cover itself when the card isn't already on the book's page), then the opening lines as
// a pull quote and who wrote it. A draft says so instead of naming the book. It lifts a little on
// hover, like the track cards.
export default function ReflectionCard({ reflection: r, showBook = true }) {
  const book = bookBySlug(r.book);
  return (
    <Card className="reflection-card h-100 rounded-4 overflow-hidden shadow-sm">
      <div
        className="reflection-card-band"
        style={{
          "--band": book ? bandFor(book.catalogueTitle ?? book.title) : BANDS[0],
          "--cover": book?.cover ? `url("${book.cover}")` : "none",
        }}
      >
        {showBook && book && <BookCover book={book} size="sm" className="reflection-card-cover" />}
        <div className="position-relative">
          {r.status === "draft" ? (
            <div className="reflection-card-kicker small text-uppercase fw-semibold mb-1">Draft · only you can see it</div>
          ) : (
            showBook &&
            book && (
              <div className="reflection-card-kicker small text-uppercase fw-semibold mb-1">
                On <i style={{ textTransform: "none" }}>{book.title}</i>
              </div>
            )
          )}
          <Card.Title as="h3" className="h4 fw-bold text-white mb-0">
            <Link to={`/reflections/${r.id}`} className="stretched-link link-light text-decoration-none">
              {r.title}
            </Link>
          </Card.Title>
        </div>
      </div>
      <Card.Body className="d-flex flex-column p-4">
        <blockquote className="reflection-card-quote mb-4">{excerpt(r.paragraphs)}</blockquote>
        <div className="d-flex align-items-center gap-2 mt-auto">
          <Byline reflection={r} />
          <span className="reflection-card-more ms-auto small fw-medium text-primary text-nowrap" aria-hidden="true">
            Read <Icon name="arrow-right" />
          </span>
        </div>
      </Card.Body>
    </Card>
  );
}
