// A reading track's books standing on a line that winds back and forth down the page, like a
// long shelf (after the "slinger" view of the Canon van Nederland). The line is drawn in pixels
// from the measured width so its turns stay round; on phones it's a straight line down the left.
import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { formatYear } from "../data/books.js";
import BookCover from "./BookCover.jsx";
import { STATUSES } from "./BookStatus.jsx";
import Icon from "./Icon.jsx";
import { SkipButton } from "./TrackFollow.jsx";

const COVER = 96; // cover width; covers are 2:3
const LINE_Y = 168; // the line's height in each row, just under the covers
const SIDE = 44; // room at either side for the turns
const TURN = 36; // radius of the turns
const STROKE = 6;
// at most three books to a row, in a centred column narrow enough that each keeps about the width it
// had at four across the full page
const MAX_WIDTH = "54rem";

function useWidth(ref) {
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    setWidth(ref.current.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref]);
  return width;
}

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

function Winding({ stops, states, onSkip, width, cols }) {
  // room for the note where the track has them, and for the skip link on a followed track
  const rowHeight = (stops.some((s) => s.note) ? 400 : 290) + (onSkip ? 30 : 0);
  const rows = Math.ceil(stops.length / cols);
  const colWidth = (width - 2 * SIDE) / cols;
  const left = STROKE;
  const right = width - STROKE;
  // where each book stands: rows run left to right, then right to left, and so on
  const place = (i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const slot = row % 2 === 0 ? col : cols - 1 - col;
    return { row, x: SIDE + (slot + 0.5) * colWidth, y: row * rowHeight + LINE_Y };
  };

  // the line: along each row, then down through a rounded turn at the end of it
  let d = `M${left + TURN} ${LINE_Y}`;
  for (let row = 0; row < rows - 1; row++) {
    const y = row * rowHeight + LINE_Y;
    const next = y + rowHeight;
    if (row % 2 === 0) {
      d += `H${right - TURN}A${TURN} ${TURN} 0 0 1 ${right} ${y + TURN}V${next - TURN}A${TURN} ${TURN} 0 0 1 ${right - TURN} ${next}`;
    } else {
      d += `H${left + TURN}A${TURN} ${TURN} 0 0 0 ${left} ${y + TURN}V${next - TURN}A${TURN} ${TURN} 0 0 0 ${left + TURN} ${next}`;
    }
  }
  const last = place(stops.length - 1);
  const end = last.row % 2 === 0 ? last.x + colWidth / 2 : last.x - colWidth / 2;
  d += `H${end}`;

  return (
    <div className="position-relative" style={{ height: rows * rowHeight }}>
      <svg className="position-absolute top-0 start-0" width={width} height={rows * rowHeight} aria-hidden="true">
        <path d={d} fill="none" stroke="var(--bs-primary)" strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={left + TURN} cy={LINE_Y} r={9} fill="var(--bs-primary)" />
        {/* a flag where the track ends */}
        <line x1={end} y1={last.y} x2={end} y2={last.y - 44} stroke="var(--bs-primary)" strokeWidth={3} strokeLinecap="round" />
        <path d={`M${end} ${last.y - 44}l${last.row % 2 === 0 ? 24 : -24} 8l${last.row % 2 === 0 ? -24 : 24} 8Z`} fill="#e8705a" />
      </svg>
      <ol className="list-unstyled m-0">
        {stops.map((stop, i) => {
          const { x, y } = place(i);
          return (
            <li key={stop.book.slug} className="position-absolute text-center" style={{ left: x - colWidth / 2, top: y - LINE_Y, width: colWidth }}>
              <div className="d-flex align-items-end justify-content-center" style={{ height: LINE_Y - STROKE / 2 }}>
                <Link to={`/books/${stop.book.slug}`} style={{ width: COVER }} tabIndex={-1} className={states?.[i].skipped ? "opacity-50" : ""}>
                  <BookCover book={stop.book} />
                </Link>
              </div>
              <StopText stop={stop} number={i + 1} state={states?.[i]} onSkip={onSkip} className="px-2 mt-3" />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Straight({ stops, states, onSkip }) {
  return (
    <ol className="list-unstyled m-0 ms-2" style={{ borderLeft: `${STROKE}px solid var(--bs-primary)` }}>
      {stops.map((stop, i) => (
        <li key={stop.book.slug} className="d-flex gap-3 ps-3 pb-4 position-relative">
          <span
            className="position-absolute rounded-circle bg-primary"
            style={{ width: 14, height: 14, left: -(STROKE / 2) - 7, top: 8 }}
            aria-hidden="true"
          />
          <Link to={`/books/${stop.book.slug}`} tabIndex={-1} className={states?.[i].skipped ? "opacity-50" : ""}>
            <BookCover book={stop.book} size="sm" />
          </Link>
          <StopText stop={stop} number={i + 1} state={states?.[i]} onSkip={onSkip} />
        </li>
      ))}
    </ol>
  );
}

// states: each stop's place in the reader's progress (trackProgress), when logged in; onSkip(book,
// skipped): on a track they follow
export default function TrackPath({ stops, states, onSkip }) {
  const ref = useRef(null);
  const width = useWidth(ref);
  const cols = width >= 640 ? 3 : 0;
  if (!stops.length) return null;
  return (
    <div ref={ref} className="mx-auto" style={{ maxWidth: MAX_WIDTH }}>
      {cols ? <Winding stops={stops} states={states} onSkip={onSkip} width={width} cols={cols} /> : <Straight stops={stops} states={states} onSkip={onSkip} />}
    </div>
  );
}
