import { useState } from "react";
import { Button, Card, Spinner } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { formatDate } from "../data/reflections.js";
import { keptTracks, trackProgress } from "../data/tracks.js";
import { read, useFollows, useStatuses, useTracks, useUser } from "../store.js";
import BookCover from "./BookCover.jsx";
import BookStatusButton from "./BookStatus.jsx";
import BusyButton from "./BusyButton.jsx";
import Icon from "./Icon.jsx";
import { useMessage } from "./Messages.jsx";

// Where the reader is on a track and what they can do with it. Logged-out readers log in first and
// come back. Leaving a track asks first, with the browser's own confirm dialog like the site's other
// deletions; the message area says what happened.
export function useTrackFollow(track) {
  const user = useUser();
  const [follows, setFollow, setSkip] = useFollows();
  const [statuses] = useStatuses();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const message = useMessage();
  // the state the track is going to while the API works on it, null to leave it
  const [changing, setChanging] = useState(undefined);
  const follow = (user && follows[track.id]) || null;
  const progress = trackProgress(track, user ? statuses : {}, follow);
  const shelf = (
    <Link to="/bookshelf?shelf=tracks" className="alert-link">
      your bookshelf
    </Link>
  );

  const loggedIn = () => user || (navigate(`/log-in?next=${encodeURIComponent(pathname + search)}`), false);

  async function change(state) {
    if (!loggedIn()) return;
    const leave =
      follow?.state === "saved"
        ? `Take “${track.title}” off your bookshelf?`
        : `Leave “${track.title}”? Your books keep where you are with them; the ones you skipped on it come back.`;
    if (!state && !window.confirm(leave)) return;
    setChanging(state);
    const done = await setFollow(track.id, state);
    setChanging(undefined);
    if (!done) return;
    // what the API made of it: the book up next, or the whole track completed
    const after = trackProgress(track, read("statuses"), read("follows")[track.id]);
    if (!state) message(<>{track.title} is off {shelf}.</>, "info");
    else if (state === "saved") message(<>{track.title} is saved for later on {shelf}.</>);
    else if (state === "paused") message(<>{track.title} is paused. It keeps your place until you resume it.</>, "info");
    else if (read("follows")[track.id]?.state === "completed" || !after.next) message(<>You&apos;ve read every book on {track.title} already, so it&apos;s completed.</>);
    else if (follow?.state === "completed")
      message(
        <>
          You&apos;re back on {track.title}. Up next: <i>{after.next.book.title}</i>, on your{" "}
          <Link to="/bookshelf?shelf=want" className="alert-link">
            Want to read
          </Link>
          .
        </>,
      );
    else
      message(
        <>
          You&apos;re following {track.title}. Up next: <i>{after.next.book.title}</i>, on your{" "}
          <Link to="/bookshelf?shelf=want" className="alert-link">
            Want to read
          </Link>
          .
        </>,
      );
  }

  async function skip(book, skipped) {
    if (!loggedIn()) return;
    if (!(await setSkip(track.id, book.slug, skipped))) return;
    message(skipped ? <><i>{book.title}</i> is skipped on this track. It still counts as done here.</> : <><i>{book.title}</i> is back on this track.</>, "info");
  }

  return { follow, progress, change, skip, changing };
}

// Skipping a book on a track the reader follows, or undoing that
export function SkipButton({ book, skipped = false, onSkip, ...props }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    await onSkip(book, !skipped);
    setBusy(false);
  }
  return (
    <BusyButton variant="link" busy={busy} busyText={skipped ? "Undoing…" : "Skipping…"} onClick={toggle} {...props}>
      {skipped ? "Undo skip" : "Skip on this track"}
    </BusyButton>
  );
}

// One block per stop, across the width of the page: finished solid, skipped faint, up next outlined,
// the rest empty. The number shows while the blocks are wide enough to hold it.
function StopBar({ stops }) {
  const numbered = stops.length <= 18;
  return (
    <div className="d-flex gap-2" aria-hidden="true">
      {stops.map((s) => (
        <span
          key={s.book.slug}
          title={`${s.number} · ${s.book.title}`}
          className={`flex-fill rounded-2 d-flex align-items-center justify-content-center fw-semibold ${s.status === "finished" ? "bg-primary text-white" : s.skipped ? "bg-secondary-subtle text-body-secondary" : s.upNext ? "bg-primary-subtle border border-primary" : "bg-body-secondary text-body-secondary"}`}
          style={{ height: "3rem", fontSize: numbered ? "1rem" : 0 }}
        >
          {numbered ? s.number : ""}
        </span>
      ))}
    </div>
  );
}

const counts = ({ finished, skipped }) => [`${finished} finished`, skipped > 0 && `${skipped} skipped`].filter(Boolean).join(", ");

const PLACE = {
  following: ["Following", "startedAt"],
  paused: ["Paused", "pausedAt"],
  completed: ["Completed", "completedAt"],
};

// Where the reader stands on a track's page. Not followed: one line on what following does, then
// Start and Save, kept narrow. Followed: a panel the width of the page, with how far they are and
// the book up next. Paused and completed say since when.
export function FollowCard({ track }) {
  const { follow, progress, change, skip, changing } = useTrackFollow(track);
  const busy = changing !== undefined;
  const state = follow?.state ?? null;
  const { next, done, total } = progress;

  // a retired track is only for the readers who already keep it
  if (track.retired && !state) {
    return (
      <Card className="shadow-sm mx-auto" style={{ maxWidth: "30rem" }}>
        <Card.Body className="p-4">
          <h2 className="h6">This track is retired</h2>
          <p className="small text-body-secondary mb-0">
            It&apos;s no longer on Discover and can&apos;t be started, but the readers who follow it can still finish it.
          </p>
        </Card.Body>
      </Card>
    );
  }

  if (!state || state === "saved") {
    return (
      <div className="text-center mx-auto" style={{ maxWidth: "30rem" }}>
        <p className="small text-body-secondary mb-3">
          Read its books in order. The first goes on Want to read, and the next one when you finish it.
          {progress.finished > 0 && ` You've finished ${progress.finished} of its ${total} books already, and they count.`}
        </p>
        <div className="d-flex flex-wrap justify-content-center align-items-center gap-2">
          <BusyButton disabled={busy} busy={changing === "following"} busyText="Starting…" onClick={() => change("following")}>
            Start this track
          </BusyButton>
          <BusyButton
            variant={state ? "outline-primary" : "outline-secondary"}
            aria-pressed={Boolean(state)}
            disabled={busy}
            busy={changing === (state ? null : "saved")}
            busyText={state ? "Removing…" : "Saving…"}
            onClick={() => change(state ? null : "saved")}
          >
            <Icon name={state ? "bookmark-fill" : "bookmark"} className="me-2" />
            {state ? "Saved for later" : "Save for later"}
          </BusyButton>
        </div>
      </div>
    );
  }

  const [place, when] = PLACE[state];
  return (
    <Card className="text-start rounded-4 shadow-sm">
      <Card.Body className="p-4 p-lg-5">
        <div className="d-flex flex-wrap justify-content-between align-items-end gap-3 mb-4">
          <div>
            <div className="text-uppercase fw-semibold text-body-secondary mb-1" style={{ letterSpacing: "0.08em", fontSize: "0.75rem" }}>
              Your place
            </div>
            <h2 className="display-6 fw-bold mb-1">{place}</h2>
            <div className="text-body-secondary">{state === "following" ? `since ${formatDate(follow[when])}` : formatDate(follow[when])}</div>
          </div>
          <div className="text-md-end">
            <div className="display-4 fw-bold lh-1" style={{ fontVariantNumeric: "tabular-nums" }}>
              {done}
              <span className="text-body-secondary fs-2"> / {total}</span>
            </div>
            <div className="text-body-secondary mt-1">{counts(progress) || "None finished yet"}</div>
          </div>
        </div>
        <StopBar stops={progress.stops} />

        {next && state !== "completed" && (
          <div className="d-flex flex-column flex-lg-row align-items-lg-center gap-4 border-top mt-4 pt-4">
            <Link to={`/books/${next.book.slug}`} tabIndex={-1} className="flex-shrink-0">
              <BookCover book={next.book} size="lg" />
            </Link>
            <div className="min-w-0">
              <div className="text-uppercase fw-semibold text-body-secondary mb-1" style={{ letterSpacing: "0.08em", fontSize: "0.75rem" }}>
                Up next · stop {next.number}
              </div>
              <Link to={`/books/${next.book.slug}`} className="h3 fw-bold link-body-emphasis text-decoration-none d-block">
                {next.book.title}
              </Link>
              <div className="text-body-secondary mb-0">{next.book.author}</div>
            </div>
            <div className="d-flex flex-wrap align-items-center gap-2 ms-lg-auto">
              {state === "following" ? (
                <>
                  <BookStatusButton book={next.book} />
                  <SkipButton book={next.book} onSkip={skip} size="sm" className="link-secondary" />
                </>
              ) : (
                <BusyButton disabled={busy} busy={changing === "following"} busyText="Resuming…" onClick={() => change("following")}>
                  Resume
                </BusyButton>
              )}
            </div>
          </div>
        )}
        {state === "completed" &&
          (next ? (
            // the track gained stops since the reader completed it: it stays completed until they
            // carry on
            <div className="border-top mt-4 pt-4">
              <p className="mb-3">
                <Icon name="flag-fill" className="text-primary me-2" />
                The track has changed since you completed it: {total - done === 1 ? "1 stop isn't" : `${total - done} stops aren't`} done
                yet.
              </p>
              <BusyButton disabled={busy} busy={changing === "following"} busyText="Continuing…" onClick={() => change("following")}>
                Continue the track
              </BusyButton>
            </div>
          ) : (
            <p className="border-top mt-4 pt-4 mb-0">
              <Icon name="flag-fill" className="text-primary me-2" />
              You&apos;ve been through the whole track.
            </p>
          ))}

        <div className="d-flex flex-wrap gap-3 small mt-4">
          {state === "following" && (
            <BusyButton variant="link" className="p-0 small link-secondary" disabled={busy} busy={changing === "paused"} busyText="Pausing…" onClick={() => change("paused")}>
              Pause track
            </BusyButton>
          )}
          <BusyButton variant="link" className="p-0 small link-danger" disabled={busy} busy={changing === null} busyText="Leaving…" onClick={() => change(null)}>
            Leave track
          </BusyButton>
        </div>
      </Card.Body>
    </Card>
  );
}

// The bookmark on a track card: saves one of our tracks for later, or takes it off again. Grey until
// saved and blue after, like the bookmark on the book cards. Once followed, the card shows how far
// the reader is instead (TrackCard.jsx).
export function SaveTrackButton({ track, className = "", style }) {
  const { follow, change, changing } = useTrackFollow(track);
  const on = follow?.state === "saved";
  const busy = changing !== undefined;
  return (
    <Button
      variant="link"
      className={`p-0 lh-1 border-0 ${on ? "link-primary" : "link-secondary"} ${className}`}
      style={style}
      aria-pressed={on}
      // in a grid of cards each one is the same bookmark, so name its track for screen readers
      aria-label={`Save for later: ${track.title}`}
      title={on ? "Saved for later" : "Save for later"}
      disabled={busy}
      aria-busy={busy || undefined}
      onClick={() => change(on ? null : "saved")}
    >
      {busy ? <Spinner as="span" animation="border" size="sm" aria-hidden="true" /> : <Icon name={on ? "bookmark-fill" : "bookmark"} />}
    </Button>
  );
}

// On a book's page, a line for each track the reader follows (or paused) with the book on it: which
// stop it is and where they are with it there
export function OnYourTracks({ book }) {
  const user = useUser();
  const [follows] = useFollows();
  const [statuses] = useStatuses();
  const [own] = useTracks();
  if (!user) return null;
  const lines = keptTracks(follows, own)
    .filter(({ follow }) => ["following", "paused"].includes(follow.state))
    .map(({ track, follow }) => {
      const stop = trackProgress(track, statuses, follow).stops.find((s) => s.book.slug === book.slug);
      return stop && { track, follow, stop };
    })
    .filter(Boolean);
  if (!lines.length) return null;
  return (
    <ul className="list-unstyled small text-body-secondary mt-2 mb-0">
      {lines.map(({ track, follow, stop }) => (
        <li key={track.id}>
          Stop {stop.number} of {track.books.length} on <Link to={`/tracks/${track.id}`}>{track.title}</Link>
          {follow.state === "paused" ? " (paused)" : stop.upNext ? " · up next" : stop.skipped ? " · skipped" : stop.ahead ? " · read ahead" : ""}
        </li>
      ))}
    </ul>
  );
}
