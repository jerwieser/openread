import { Card } from "react-bootstrap";
import { Link } from "react-router-dom";

import { formatYear } from "../data/books.js";
import { FOLLOW_LABEL } from "../data/tracks.js";
import BookCover from "./BookCover.jsx";
import { SeeAll } from "./PageHeader.jsx";
import { SaveTrackButton, useTrackFollow } from "./TrackFollow.jsx";
import "./TrackCard.css";

// "c. 1260 – 1953", from the oldest book to the newest whatever order they're read in
function yearSpan(track) {
  const dated = track.books.map((s) => s.book).filter((b) => b.year != null).sort((a, b) => a.year - b.year);
  return dated.length > 1 ? `${formatYear(dated[0])} – ${formatYear(dated.at(-1))}` : "";
}

// "10 books · c. 1260 – 1953"
export function trackSpan(track) {
  const span = yearSpan(track);
  return `${track.books.length} books${span ? ` · ${span}` : ""}`;
}

// the readers' own tracks have a description but no tagline: show its opening
function excerpt(text = "", length = 110) {
  return text.length <= length ? text : `${text.slice(0, text.lastIndexOf(" ", length))}…`;
}

// A track's covers fanned out on a shelf, in front of the track's picture when it has one: the top of
// its card and (large) the banner at the top of its page. Every book is on the shelf, up to ten; a
// longer track shows its first ten and how many more follow. Every cover is the same size whatever
// the number of books, so all the cards' shelves are the same height: more covers just overlap more
// and lean less. The card draws the picture itself, across the whole card, so it passes
// withImage={false}.
const MAX_COVERS = 10;

export function TrackShelf({ track, large = false, withImage = true, className = "" }) {
  const covers = track.books.slice(0, MAX_COVERS);
  const more = track.books.length - covers.length;
  const n = covers.length;
  const middle = (n - 1) / 2;
  // each cover's share of the shelf's width, in %, the same for every track; and how much of a cover
  // each side tucks under its neighbours, so all of them fit in the shelf, a little less on hover
  const width = large ? 12 : 17;
  const overlap = Math.max(0.05, (1 - 88 / (n * width)) / 2);
  const spread = Math.max(0.02, Math.min(overlap - 0.04, (1 - 94 / (n * width)) / 2));
  const tilt = Math.min(5, 24 / n);
  return (
    <div
      className={`track-card-band ${track.image ? "track-card-band-image" : ""} ${large ? "track-card-band-lg" : ""} ${className}`}
      style={{
        ...(track.image && withImage ? { backgroundImage: `url("${track.image}")` } : {}),
        "--cover-width": `${width}%`,
        "--cover-overlap": overlap,
        "--cover-spread": spread,
      }}
      aria-hidden="true"
    >
      {covers.map((s, i) => {
        const offset = i - middle; // the middle covers stand straightest and in front, the others lean out
        return (
          <div key={s.book.slug} className="track-card-cover" style={{ transform: `rotate(${offset * tilt}deg)`, zIndex: 10 - Math.round(Math.abs(offset)) }}>
            <BookCover book={s.book} />
          </div>
        );
      })}
      {more > 0 && <span className="track-card-more badge rounded-pill text-bg-dark">+{more}</span>}
    </div>
  );
}

// A track as a bordered card: its shelf of covers at the top, then its title, what it's about, how
// far the reader is on it (following, paused or completed) or how many of its books they've
// finished and, on ours they don't follow, the bookmark to save it for later. The track's picture
// fills the whole card, and the text sits on a frosted panel that fades in below the shelf, so it
// stays easy to read on any picture. showcase: on the home page, which shows OpenRead to newcomers, a
// "Details →" link instead of the bookmark and the reader's own progress.
// a step up from the book cards' type (BookCard.jsx: 13px and 12px), as the card is twice as wide
const TITLE = { fontSize: "0.9375rem" };
const TEXT = { fontSize: "0.8125rem" };

export default function TrackCard({ track, showcase = false }) {
  const { follow, progress } = useTrackFollow(track);
  const total = track.books.length;
  // on a track they follow, the stops done (finished or skipped); on any other, the books finished
  const followed = follow && follow.state !== "saved";
  const read = followed ? progress.done : progress.finished;
  const where = followed
    ? follow.state === "completed"
      ? // a completed track that gained stops says how far the reader is on it now
        read === total
        ? FOLLOW_LABEL.completed
        : `${FOLLOW_LABEL.completed} · ${read} of ${total}`
      : `${FOLLOW_LABEL[follow.state]} · ${read} of ${total}`
    : read > 0 && (read === total ? "All read" : `${read} of ${total} finished`);

  return (
    <Card
      className={`track-card h-100 rounded-4 overflow-hidden ${track.image ? "track-card-image" : ""}`}
      style={track.image ? { backgroundImage: `url("${track.image}")` } : undefined}
    >
      <TrackShelf track={track} withImage={false} />
      <Card.Body className="track-card-body d-flex flex-column p-3">
        <div className="text-body-secondary mb-1" style={TEXT}>
          {track.own ? "Your reading track" : "Reading track"} · {total} books{track.retired && " · retired"}
        </div>
        <Card.Title as="h3" className="fw-semibold lh-sm mb-1" style={TITLE}>
          <Link to={`/tracks/${track.id}`} className="stretched-link link-body-emphasis text-decoration-none">
            {track.title}
          </Link>
        </Card.Title>
        <Card.Text className="text-body-secondary lh-sm" style={TEXT}>{track.tagline ?? excerpt(track.description)}</Card.Text>
        <div className="text-body-secondary mt-auto pt-2 border-top" style={TEXT}>
          <div className="d-flex align-items-center gap-2">
            <span className="me-auto">{yearSpan(track)}</span>
            {/* above the title's stretched link, which otherwise covers the whole card */}
            {showcase ? (
              <SeeAll to={`/tracks/${track.id}`} className="position-relative" style={{ zIndex: 2 }}>
                Details<span className="visually-hidden">: {track.title}</span>
              </SeeAll>
            ) : (
              <>
                {where && <span className="text-primary fw-semibold">{where}</span>}
                {!track.own && !track.shared && !followed && (
                  <SaveTrackButton track={track} className="position-relative" style={{ zIndex: 2 }} />
                )}
              </>
            )}
          </div>
          {!showcase && read > 0 && (
            <div
              className="progress mt-2"
              role="progressbar"
              aria-label={followed ? "Stops of this track you've done" : "Books of this track you've finished"}
              aria-valuenow={read}
              aria-valuemin={0}
              aria-valuemax={total}
              style={{ height: 4 }}
            >
              <div className="progress-bar" style={{ width: `${(read / total) * 100}%` }} />
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}
