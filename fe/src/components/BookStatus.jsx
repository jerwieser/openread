import { Button, ButtonGroup, Dropdown } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { keptTracks, trackProgress } from "../data/tracks.js";
import { read, useStatuses, useUser } from "../store.js";
import Icon from "./Icon.jsx";
import { useMessage } from "./Messages.jsx";

// Where a reader is with a book: one status at a time, each with its icon, outlined in the menu and
// solid once it's the book's. Reading and finished show the reader on the book's page; the others
// are their own. The bookshelf has a shelf for each.
export const STATUSES = {
  want: { label: "Want to read", icon: "bookmark", solid: "bookmark-fill" },
  reading: { label: "Reading now", icon: "eyeglasses", solid: "eyeglasses-fill" },
  paused: { label: "Paused", icon: "pause-circle", solid: "pause-circle-fill" },
  finished: { label: "Finished", icon: "check-circle", solid: "check-circle-fill" },
  stopped: { label: "Didn't finish", icon: "stop-circle", solid: "stop-circle-fill" },
};

// What the reader can move a book to from where it is: pausing and not finishing only once they've
// started it
function nextStatuses(status) {
  const started = ["reading", "paused"].includes(status);
  return Object.keys(STATUSES).filter(
    (s) => s !== status && (s !== "paused" || status === "reading") && (s !== "stopped" || started),
  );
}

const shelfLink = (status, children) => (
  <Link to={`/bookshelf?shelf=${status}`} className="alert-link">
    {children}
  </Link>
);

// the tracks the reader follows (not paused) that have this book on them
const followedWith = (book) =>
  keptTracks(read("follows"), read("ownTracks")).filter(
    ({ track, follow }) => follow.state === "following" && track.books.some((s) => s.book.slug === book.slug),
  );

// What finishing the book did on the tracks it's on, once the API has moved them along: the one up
// next on each, or the track completed
function trackNews(ids) {
  return keptTracks(read("follows"), read("ownTracks"))
    .filter(({ track }) => ids.includes(track.id))
    .map(({ track, follow }) => {
      const link = (
        <Link to={`/tracks/${track.id}`} className="alert-link">
          {track.title}
        </Link>
      );
      const { next } = trackProgress(track, read("statuses"), follow);
      return (
        <span key={track.id}>
          {" "}
          {follow.state === "completed" || !next ? <>You&apos;ve completed {link}.</> : <>Next on {link}: <i>{next.book.title}</i>.</>}
        </span>
      );
    });
}

// The book's status and the way to change it. Logged-out readers log in first and come back. Taking
// a book off the bookshelf, or off the finished books, asks first, with the browser's own confirm
// dialog like the site's other deletions; the message area says what happened.
function useBookStatus(book) {
  const user = useUser();
  const [statuses, setStatus] = useStatuses();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const message = useMessage();
  const status = (user && statuses[book.slug]) || null;

  async function choose(next) {
    if (!user) return navigate(`/log-in?next=${encodeURIComponent(pathname + search)}`);
    const title = <i>{book.title}</i>;
    if (!next && !window.confirm(`Take “${book.title}” off your bookshelf?`)) return;
    if (next && status === "finished" && !window.confirm(`Move “${book.title}” to ${STATUSES[next].label}? It comes off the books you've finished.`)) return;
    const onTracks = next === "finished" ? followedWith(book).map(({ track }) => track.id) : [];
    await setStatus(book.slug, next);
    if (!next) message(<>{title} is off your bookshelf.</>, "info");
    else if (next === "want") message(<>{title} is on your {shelfLink("want", "Want to read")} shelf.</>);
    else if (next === "reading") message(<>You&apos;re reading {title}. Other readers see you on its page, so you can compare notes.</>);
    else if (next === "paused") message(<>{title} is paused. It waits under {shelfLink("reading", "Reading now")} until you pick it up again.</>);
    else if (next === "finished")
      message(
        <>
          You&apos;ve finished {title}. Readers can now ask you about it.{trackNews(onTracks)}{" "}
          <Link to={`/reflections/new?book=${book.slug}`} className="alert-link">
            Write a reflection
          </Link>
        </>,
      );
    else message(<>{title} is on your {shelfLink("stopped", "Didn't finish")} shelf. Not every book is for now.</>, "info");
  }
  return [status, choose];
}

// On a book's page. Not on the bookshelf yet: "Want to read" in one click, the rest in the menu
// beside it. On it: the status, solid and blue, opening the menu to move it or take it off.
export default function BookStatusButton({ book, size }) {
  const [status, choose] = useBookStatus(book);
  const current = STATUSES[status];
  return (
    <Dropdown as={ButtonGroup} size={size}>
      {!status && (
        <Button variant="outline-secondary" onClick={() => choose("want")}>
          <Icon name="bookmark" className="me-2" />
          Want to read
        </Button>
      )}
      <Dropdown.Toggle split={!status} variant={status ? "outline-primary" : "outline-secondary"} id={`status-${book.slug}`}>
        {current ? (
          <>
            <Icon name={current.solid} className="me-2" />
            {current.label}
          </>
        ) : (
          <span className="visually-hidden">More ways to put it on your bookshelf</span>
        )}
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {nextStatuses(status)
          .filter((s) => status || s !== "want")
          .map((s) => (
            <Dropdown.Item key={s} as="button" onClick={() => choose(s)}>
              <Icon name={STATUSES[s].icon} className="me-2" />
              {STATUSES[s].label}
            </Dropdown.Item>
          ))}
        {status && (
          <>
            <Dropdown.Divider />
            <Dropdown.Item as="button" className="text-danger" onClick={() => choose(null)}>
              Take off my bookshelf
            </Dropdown.Item>
          </>
        )}
      </Dropdown.Menu>
    </Dropdown>
  );
}

// The small form for book cards. Not on the bookshelf: an outlined bookmark that puts it on Want to
// read. On Want to read: the solid bookmark, which takes it off again. Further along: that status's
// solid icon, which only says where the reader is; it changes on the book's page.
export function BookStatusIcon({ book, className = "", style }) {
  const [status, choose] = useBookStatus(book);
  if (status && status !== "want") {
    const { label, solid } = STATUSES[status];
    return (
      <span className={`lh-1 text-primary ${className}`} style={style} title={label}>
        <Icon name={solid} label={`${label}: ${book.title}`} />
      </span>
    );
  }
  const on = status === "want";
  return (
    <Button
      variant="link"
      className={`p-0 lh-1 border-0 ${on ? "link-primary" : "link-secondary"} ${className}`}
      style={style}
      aria-pressed={on}
      // in a grid of cards each one is the same bookmark, so name its book for screen readers
      aria-label={`Want to read: ${book.title}`}
      title={on ? "On Want to read" : "Want to read"}
      onClick={() => choose(on ? null : "want")}
    >
      <Icon name={on ? "bookmark-fill" : "bookmark"} />
    </Button>
  );
}
