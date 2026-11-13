import { useState } from "react";
import { Badge, Button, Col, Collapse, Container, Nav, Row } from "react-bootstrap";
import { Link, useSearchParams } from "react-router-dom";

import { RequireLogin } from "../components/Auth.jsx";
import BookCard from "../components/BookCard.jsx";
import { STATUSES } from "../components/BookStatus.jsx";
import Icon from "../components/Icon.jsx";
import { BookCardPlaceholder, GridPlaceholder, Loader, TrackCardPlaceholder } from "../components/Loading.jsx";
import { BOOK_GRID, TRACK_GRID } from "../components/grids.js";
import PageHeader from "../components/PageHeader.jsx";
import TrackCard from "../components/TrackCard.jsx";
import { bookBySlug } from "../data/books.js";
import { keptTracks, toTrack, trackProgress } from "../data/tracks.js";
import { useFollows, useStatuses, useTracks } from "../store.js";

// The shelves, as pills like the admin page's, one for each status but paused, which folds away
// under Reading now: [key in ?shelf=, label, line above the books, what to say and offer while it's
// empty]
const SHELVES = [
  ["reading", STATUSES.reading.label, "Other readers see you on these books' pages and can compare notes with you.", "Mark a book as “Reading now” on its page and it shows here."],
  ["want", STATUSES.want.label, "Books you mean to read: the next one on each track you follow, then your own picks. The bookmark takes one off again.", "Put books on Want to read with their bookmark, or start a reading track."],
  ["finished", STATUSES.finished.label, "Other readers can ask you about these.", "Books you mark as “Finished” show here, so other readers can ask you about them."],
  ["stopped", STATUSES.stopped.label, "Books you put down for good. Only you see these.", "Books you start and decide not to finish show here. Only you see them."],
  ["tracks", "Tracks", "The tracks you follow, saved, completed and made, with how far you are on each.", "Start a reading track to follow it here, or put books in an order of your own."],
];

// the shelves' old names, from links made before every book had one status
const RENAMED = { list: "want", read: "finished" };

// The books the reader paused, under the ones they're reading: folded away, like StoryGraph's, so
// Reading now shows what they're actually reading
function Paused({ books }) {
  const [open, setOpen] = useState(false);
  if (!books.length) return null;
  return (
    <section className="mt-5 pt-4 border-top">
      <Button
        variant="link"
        className="d-flex align-items-center gap-2 mx-auto link-secondary text-decoration-none"
        aria-expanded={open}
        aria-controls="paused-books"
        onClick={() => setOpen(!open)}
      >
        <Icon name={STATUSES.paused.icon} />
        {STATUSES.paused.label} · {books.length}
        <Icon name={open ? "chevron-up" : "chevron-down"} />
      </Button>
      <Collapse in={open}>
        <div id="paused-books">
          <p className="text-body-secondary text-center small mt-2 mb-4">Books you put down for now. Pick one up again on its page.</p>
          <Books books={books} />
        </div>
      </Collapse>
    </section>
  );
}

// caption: a line under a book's card, like which track it's next on
function Books({ books, caption }) {
  return (
    <Loader fallback={<GridPlaceholder Item={BookCardPlaceholder} count={Math.min(books.length, 6)} {...BOOK_GRID} />}>
      <Row {...BOOK_GRID}>
        {books.map((b) => (
          <Col key={b.slug}>
            {caption ? (
              // the card fills the height it's given, so the caption gets its own line under a box of
              // its own, not stretched into the card
              <>
                <div>
                  <BookCard book={b} />
                </div>
                <div className="small text-body-secondary text-truncate mt-1">{caption(b)}</div>
              </>
            ) : (
              <BookCard book={b} />
            )}
          </Col>
        ))}
      </Row>
    </Loader>
  );
}

function Tracks({ tracks }) {
  // the same grid as everywhere else (components/grids.js), so the cards look the same in every place
  return (
    <Loader fallback={<GridPlaceholder Item={TrackCardPlaceholder} count={Math.min(tracks.length, 3)} {...TRACK_GRID} />}>
      <Row {...TRACK_GRID}>
        {tracks.map((t) => (
          <Col key={t.id}>
            <TrackCard track={t} />
          </Col>
        ))}
      </Row>
    </Loader>
  );
}

// A shelf in parts, each under its heading, centred like the cards under it, the empty ones left
// out: the heading only once there are two parts to tell apart
function Parts({ parts }) {
  const filled = parts.filter(({ items }) => items.length);
  return filled.map(({ title, items, render }, i) => (
    <section key={title} className={i > 0 ? "mt-5" : ""}>
      {filled.length > 1 && <h2 className="h6 text-body-secondary text-center mb-3">{title}</h2>}
      {render(items)}
    </section>
  ));
}

// The book up next on each track the reader follows, while it waits on Want to read, with the
// tracks it's next on
function upNext(kept, statuses) {
  const next = new Map();
  for (const { track, follow } of kept) {
    if (follow.state !== "following") continue;
    const stop = trackProgress(track, statuses, follow).next;
    if (stop?.status === "want") next.set(stop.book.slug, [...(next.get(stop.book.slug) ?? []), { track, stop }]);
  }
  return next;
}

// The reader's books and tracks, one shelf at a time: the one in ?shelf=, or the first with
// something on it
function Bookshelf() {
  const [params, setParams] = useSearchParams();
  const [statuses] = useStatuses();
  const [follows] = useFollows();
  const [own] = useTracks();
  const kept = keptTracks(follows, own);
  const keptIn = (...states) => kept.filter(({ follow }) => states.includes(follow.state)).map(({ track }) => track);
  const next = upNext(kept, statuses);
  // each status's books, the most recently changed first, as the API lists them
  const marked = (status) => Object.keys(statuses).filter((slug) => statuses[slug] === status).map(bookBySlug).filter(Boolean);
  const paused = marked("paused");
  const items = {
    reading: marked("reading"),
    want: marked("want"),
    finished: marked("finished"),
    stopped: marked("stopped"),
    tracks: [...kept.map(({ track }) => track), ...own.filter((t) => !follows[t.id]).map(toTrack)],
  };
  // each shelf's books or tracks in parts: Want to read, the ones up next on the reader's tracks
  // first; Tracks, by how far the reader is on them
  const parts = {
    want: [
      {
        title: "Up next on your tracks",
        items: items.want.filter((b) => next.has(b.slug)),
        render: (books) => (
          <Books
            books={books}
            caption={(b) =>
              next.get(b.slug).map(({ track, stop }, i) => (
                <span key={track.id}>
                  {i > 0 && ", "}
                  Stop {stop.number} on <Link to={`/tracks/${track.id}`}>{track.title}</Link>
                </span>
              ))
            }
          />
        ),
      },
      { title: "Your picks", items: items.want.filter((b) => !next.has(b.slug)), render: (books) => <Books books={books} /> },
    ],
    tracks: [
      { title: "Following", items: keptIn("following", "paused"), render: (tracks) => <Tracks tracks={tracks} /> },
      { title: "Saved for later", items: keptIn("saved"), render: (tracks) => <Tracks tracks={tracks} /> },
      { title: "Completed", items: keptIn("completed"), render: (tracks) => <Tracks tracks={tracks} /> },
      { title: "Made by you", items: own.filter((t) => !follows[t.id]).map(toTrack), render: (tracks) => <Tracks tracks={tracks} /> },
    ],
  };
  const asked = RENAMED[params.get("shelf")] ?? params.get("shelf");
  // without one asked for, the first shelf with something on it; paused books count for Reading now,
  // where they fold away, but not in its badge, which counts what the shelf shows
  const filled = (key) => items[key].length || (key === "reading" && paused.length);
  const shelf = SHELVES.some(([key]) => key === asked) ? asked : (SHELVES.find(([key]) => filled(key))?.[0] ?? "reading");
  const [, , intro, empty] = SHELVES.find(([key]) => key === shelf);
  const shown = items[shelf];

  return (
    <Container className="py-5">
      <PageHeader title="Bookshelf">What you&apos;re reading, what&apos;s next and what you&apos;ve finished.</PageHeader>
      <Nav
        variant="pills"
        activeKey={shelf}
        onSelect={(key) => setParams({ shelf: key }, { replace: true })}
        className="justify-content-center mb-4"
      >
        {SHELVES.map(([key, label]) => (
          <Nav.Item key={key}>
            <Nav.Link eventKey={key} className="d-flex align-items-center gap-2">
              {label}
              <Badge pill bg={shelf === key ? "light" : "secondary"} text={shelf === key ? "primary" : undefined}>
                {items[key].length}
              </Badge>
            </Nav.Link>
          </Nav.Item>
        ))}
      </Nav>

      {shown.length ? (
        <>
          <div className="d-flex flex-wrap justify-content-center align-items-center column-gap-3 row-gap-2 text-center mb-4">
            <p className="text-body-secondary mb-0">{intro}</p>
            {shelf === "tracks" && (
              <Button as={Link} to="/tracks/new" variant="outline-primary" size="sm">
                Create a track
              </Button>
            )}
          </div>
          <div key={shelf}>{parts[shelf] ? <Parts parts={parts[shelf]} /> : <Books books={shown} />}</div>
          {shelf === "reading" && <Paused books={paused} />}
        </>
      ) : (
        <div className="text-center py-5">
          <p className="lead text-body-secondary col-lg-6 mx-auto mb-4">{empty}</p>
          {shelf === "tracks" ? (
            <div className="d-flex flex-wrap justify-content-center gap-2">
              <Button as={Link} to="/discover" variant="outline-primary">
                Discover tracks
              </Button>
              <Button as={Link} to="/tracks/new" variant="outline-secondary">
                Create a track
              </Button>
            </div>
          ) : (
            <div className="d-flex flex-wrap justify-content-center gap-2">
              <Button as={Link} to="/discover" variant="outline-primary">
                Discover something to read
              </Button>
              {/* coming from Goodreads or The StoryGraph, the empty shelf can fill in one go */}
              <Button as={Link} to="/import" variant="outline-secondary">
                Import your books
              </Button>
            </div>
          )}
          {shelf === "reading" && <Paused books={paused} />}
        </div>
      )}
    </Container>
  );
}

export default function BookshelfPage() {
  return (
    <RequireLogin why="Log in to see your tracks and the books on your bookshelf.">
      <Bookshelf />
    </RequireLogin>
  );
}
