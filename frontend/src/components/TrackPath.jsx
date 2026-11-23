// A reading track's books standing on a line that winds back and forth down the page, like a
// long shelf (after the "slinger" view of the Canon van Nederland). Two books to a row, so each
// cover can be large. The line is drawn in pixels from the measured width so its turns stay round;
// on a narrow phone it's a straight line down the left. The page behind the track is Bootstrap's
// dark, so the line is white.
import { useLayoutEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { formatYear } from "../data/books.js";
import BookCover from "./BookCover.jsx";
import { STATUSES } from "./BookStatus.jsx";
import Icon from "./Icon.jsx";
import { SkipButton } from "./TrackFollow.jsx";

const SIDE = 48; // room at either side for the turns
const TURN = 36; // radius of the turns
const STROKE = 6;
const LINE = "#fff";
// two covers across, as wide as the page allows, up to this
const COVER_MAX = 300;

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

function Winding({ stops, states, onSkip, width }) {
  const cols = 2;
  const colWidth = (width - 2 * SIDE) / cols;
  const cover = Math.min(COVER_MAX, Math.floor(colWidth * 0.82));
  const lineY = Math.round(cover * 1.5) + 20; // the line sits just under the covers
  // room for the note where the track has them, and for the skip link on a followed track
  const rowHeight = lineY + (stops.some((s) => s.note) ? 210 : 130) + (onSkip ? 30 : 0);
  const rows = Math.ceil(stops.length / cols);
  const left = STROKE;
  const right = width - STROKE;
  // where each book stands: rows run left to right, then right to left, and so on
  const place = (i) => {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const slot = row % 2 === 0 ? col : cols - 1 - col;
    return { row, x: SIDE + (slot + 0.5) * colWidth, y: row * rowHeight + lineY };
  };

  // the line: along each row, then down through a rounded turn at the end of it
  let d = `M${left + TURN} ${lineY}`;
  for (let row = 0; row < rows - 1; row++) {
    const y = row * rowHeight + lineY;
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
        <path d={d} fill="none" stroke={LINE} strokeWidth={STROKE} strokeLinecap="round" strokeLinejoin="round" />
        <circle cx={left + TURN} cy={lineY} r={9} fill={LINE} />
        {/* a flag where the track ends */}
        <line x1={end} y1={last.y} x2={end} y2={last.y - 44} stroke={LINE} strokeWidth={3} strokeLinecap="round" />
        <path d={`M${end} ${last.y - 44}l${last.row % 2 === 0 ? 24 : -24} 8l${last.row % 2 === 0 ? -24 : 24} 8Z`} fill="#e8705a" />
      </svg>
      <ol className="list-unstyled m-0">
        {stops.map((stop, i) => {
          const { x, y } = place(i);
          return (
            <li key={stop.book.slug} className="position-absolute text-center" style={{ left: x - colWidth / 2, top: y - lineY, width: colWidth }}>
              <div className="d-flex align-items-end justify-content-center" style={{ height: lineY - STROKE / 2 }}>
                <Link to={`/books/${stop.book.slug}`} style={{ width: cover }} tabIndex={-1} className={states?.[i]?.skipped ? "opacity-50" : ""}>
                  <BookCover book={stop.book} className="w-100" />
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
    <ol className="list-unstyled m-0 ms-2" style={{ borderLeft: `${STROKE}px solid ${LINE}` }}>
      {stops.map((stop, i) => (
        <li key={stop.book.slug} className="d-flex gap-3 ps-3 pb-4 position-relative">
          <span
            className="position-absolute rounded-circle bg-white"
            style={{ width: 14, height: 14, left: -(STROKE / 2) - 7, top: 8 }}
            aria-hidden="true"
          />
          <Link to={`/books/${stop.book.slug}`} tabIndex={-1} className={`flex-shrink-0 ${states?.[i]?.skipped ? "opacity-50" : ""}`} style={{ width: "9.5rem" }}>
            <BookCover book={stop.book} className="w-100" />
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
  if (!stops.length) return null;
  return (
    <div ref={ref}>
      {width >= 560 ? <Winding stops={stops} states={states} onSkip={onSkip} width={width} /> : width > 0 && <Straight stops={stops} states={states} onSkip={onSkip} />}
    </div>
  );
}
