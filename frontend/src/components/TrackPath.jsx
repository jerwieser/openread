// A reading track's books down a straight line, one under the next. The line used to wind back and
// forth across the page; it now only goes down, so the order is the thing you see. The page behind
// it is Bootstrap's dark, so the line is white. The covers are large: this is the track.
import { Link } from "react-router-dom";

import { formatYear } from "../data/books.js";
import BookCover from "./BookCover.jsx";
import { STATUSES } from "./BookStatus.jsx";
import Icon from "./Icon.jsx";
import { SkipButton } from "./TrackFollow.jsx";

const STROKE = 6;
const LINE = "#fff";

// "1 · Erasmus", the book's title (after the icon of where the reader is with it), its author and
// year, and the note when the track has one. On a track the reader follows (state, from
// trackProgress): the stop up next is marked, a skipped one struck through, a book finished past the
// one up next is "read ahead", and the stops not done yet can be skipped here.
function StopText({ stop, number, state, onSkip, className = "" }) {
  const { book, window, note } = stop;
  const status = state?.status;
  const skipped = state?.skipped;
  return (
    <div className={className}>
      <div className="small text-primary fw-semibold">
        {number}
        {window && ` · ${window}`}
        {state?.upNext && <span className="badge text-bg-primary ms-2">Up next</span>}
      </div>
      <Link
        to={`/books/${book.slug}`}
        className={`fw-semibold ${skipped ? "link-secondary text-decoration-line-through" : "link-body-emphasis text-decoration-none"}`}
      >
        {skipped ? (
          <Icon name="skip-forward-circle" label="Skipped on this track" className="me-1" />
        ) : (
          status && <Icon name={STATUSES[status].solid} label={STATUSES[status].label} className="text-primary me-1" />
        )}
        {book.title}
      </Link>
      <div className="small text-body-secondary">
        {book.author}
        {book.year != null && ` · ${formatYear(book)}`}
        {state?.ahead && <span className="text-primary"> · read ahead</span>}
      </div>
      {note && <p className="small text-body-secondary mt-1 mb-0">{note}</p>}
      {onSkip && (skipped || !state.done) && <SkipButton book={book} skipped={skipped} onSkip={onSkip} className="p-0 small link-secondary" />}
    </div>
  );
}

// states: each stop's place in the reader's progress (trackProgress), when logged in; onSkip(book,
// skipped): on a track they follow
export default function TrackPath({ stops, states, onSkip }) {
  if (!stops.length) return null;
  return (
    <ol className="list-unstyled mx-auto" style={{ maxWidth: "40rem", borderLeft: `${STROKE}px solid ${LINE}` }}>
      {stops.map((stop, i) => (
        <li key={stop.book.slug} className="d-flex align-items-start gap-3 gap-md-4 ps-3 ps-md-4 pb-5 position-relative">
          <span
            className="position-absolute rounded-circle bg-white"
            style={{ width: 14, height: 14, left: -(STROKE / 2) - 7, top: 18 }}
            aria-hidden="true"
          />
          <Link
            to={`/books/${stop.book.slug}`}
            tabIndex={-1}
            className={`flex-shrink-0 ${states?.[i]?.skipped ? "opacity-50" : ""}`}
            style={{ width: "clamp(8.5rem, 32vw, 12rem)" }}
          >
            <BookCover book={stop.book} className="w-100" />
          </Link>
          <StopText stop={stop} number={i + 1} state={states?.[i]} onSkip={onSkip} className="pt-1 text-start" />
        </li>
      ))}
    </ol>
  );
}
