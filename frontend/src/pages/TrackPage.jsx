import { useEffect, useRef, useState } from "react";
import { Button, Container, Form, InputGroup } from "react-bootstrap";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import BusyButton from "../components/BusyButton.jsx";
import { Loader, LoadingSpinner, lazyPage } from "../components/Loading.jsx";
import { useMessage } from "../components/Messages.jsx";
import { usePageTitle } from "../components/PageHeader.jsx";
import { TrackShelf, trackSpan } from "../components/TrackCard.jsx";
import { FollowCard, useTrackFollow } from "../components/TrackFollow.jsx";
import { useHeld } from "../data/books.js";
import { decodeTrack, encodeTrack, sharedSlugs, toTrack, trackById } from "../data/tracks.js";
import { useTracks } from "../store.js";
import NotFoundPage from "./NotFoundPage.jsx";

// the books on the winding line, the biggest part of the page, loaded on its own
const TrackPath = lazyPage(() => import("../components/TrackPath.jsx"));

const LABEL = { ours: "Reading track", own: "Your reading track", shared: "Shared reading track" };

// the link that carries the track, as a small action beside Edit: copy it, or hand it to the phone's
// share sheet. The address itself only appears when the browser won't copy it.
function ShareActions({ track }) {
  const link = `${window.location.origin}/tracks/shared?t=${encodeTrack(track)}`;
  const field = useRef(null);
  const [showLink, setShowLink] = useState(false);
  const message = useMessage();
  // no clipboard access: the address is shown and selected, so it can be copied with the keyboard
  useEffect(() => {
    if (showLink) field.current?.select();
  }, [showLink]);
  async function copy() {
    try {
      await navigator.clipboard.writeText(link);
      message("The link is copied. Paste it anywhere to share the track.");
    } catch {
      setShowLink(true);
      message("Your browser wouldn't let us copy it, so the link is selected: press Ctrl+C (⌘C on a Mac) to copy it.", "warning");
    }
  }
  return (
    <>
      {showLink && (
        <InputGroup size="sm" className="flex-grow-1" style={{ minWidth: "16rem", maxWidth: "28rem" }}>
          <Form.Control ref={field} readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link to this track" />
        </InputGroup>
      )}
      <Button variant="link" size="sm" className="link-secondary" onClick={copy}>
        Copy link
      </Button>
      {navigator.share && (
        <Button variant="link" size="sm" className="link-secondary" onClick={() => navigator.share({ title: track.title, url: link }).catch(() => {})}>
          Share…
        </Button>
      )}
    </>
  );
}

// One track's page, for ours, the reader's own and shared ones: what it is, the card to follow it
// and see how far they are, and its books along the winding line, in order.
// about any of it. A shared track isn't stored anywhere, so it's followed by saving a copy first.
function TrackView({ track, kind, code }) {
  usePageTitle(track.title);
  const { follow, progress, skip } = useTrackFollow(track);
  const following = ["following", "paused"].includes(follow?.state);
  // where the reader is with each book; up next and read ahead only once they follow the track
  const states = progress.stops.map((stop) => (following ? stop : { ...stop, upNext: false, ahead: false }));
  const [, , removeTrack] = useTracks();
  const [deleting, setDeleting] = useState(false);
  const navigate = useNavigate();
  const message = useMessage();
  const copyFrom = kind === "ours" ? `from=${track.id}` : kind === "shared" ? `shared=${code}` : null;

  return (
    <Container className="py-5">
      <TrackShelf track={track} large className="rounded-4 border track-shelf-on-field" />

      {/* the track in one centred column under its shelf, like the book page: the title and what it is,
          then starting or where the reader is, then the books in order */}
      <header className="text-center mt-5">
        <p className="small text-body-secondary mb-2">
          {LABEL[kind]} · {trackSpan(track)}
          {track.retired && " · retired"}
        </p>
        <h1 className="display-3 fw-bold text-body-emphasis mb-3">{track.title}</h1>
        <div className="mx-auto" style={{ maxWidth: "40rem" }}>
          {track.tagline && <p className="fs-4">{track.tagline}</p>}
          {track.description && <p className="text-body-secondary">{track.description}</p>}
          {/* its tags, each opening the other tracks with that tag */}
          {track.tags?.length > 0 && (
            <div className="d-flex flex-wrap justify-content-center gap-2 mb-3">
              {track.tags.map((tag) => (
                <Link key={tag} to={`/discover?tags=${encodeURIComponent(tag)}`} className="badge rounded-pill text-bg-light border text-decoration-none fw-medium">
                  {tag}
                </Link>
              ))}
            </div>
          )}
          {track.source && (
            <p className="small text-body-secondary">
              Based on the{" "}
              <a href={track.source.url} target="_blank" rel="noopener">
                {track.source.label}
              </a>
              .
            </p>
          )}
        </div>
        <div className="mx-auto mt-4" style={{ maxWidth: "30rem" }}>
          {kind === "shared" ? (
            <p className="small text-body-secondary text-center">Save a copy to your tracks to follow it and keep your place.</p>
          ) : (
            <FollowCard track={track} />
          )}
        </div>

        <div className="d-flex flex-wrap justify-content-center align-items-center gap-3 mt-3">
          {kind === "own" && <ShareActions track={track} />}
          {kind === "own" && (
            <>
              <Button as={Link} to={`/tracks/${track.id}/edit`} variant="outline-primary" size="sm">
                Edit track
              </Button>
              <BusyButton
                variant="link"
                size="sm"
                className="link-danger"
                busy={deleting}
                busyText="Deleting…"
                onClick={async () => {
                  if (!window.confirm(`Delete “${track.title}”? Links you've shared keep working.`)) return;
                  setDeleting(true);
                  try {
                    await removeTrack(track.id);
                  } catch (error) {
                    setDeleting(false);
                    message(error.message, "danger");
                    return;
                  }
                  navigate("/discover");
                  message(`${track.title} is deleted.`, "info");
                }}
              >
                Delete track
              </BusyButton>
            </>
          )}
          {copyFrom && (
            <Button as={Link} to={`/tracks/new?${copyFrom}`} variant="link" size="sm" className="link-secondary">
              {kind === "shared" ? "Save a copy to my tracks" : "Make your own version"}
            </Button>
          )}
        </div>
      </header>

      <section aria-label="The books, in order" className="mt-5">
        <Loader key={track.id} fallback={<LoadingSpinner label="Loading the books…" minHeight="24rem" />}>
          <TrackPath stops={track.books} states={kind === "shared" ? undefined : states} onSkip={following ? skip : undefined} />
        </Loader>
      </section>

    </Container>
  );
}

// /tracks/:id, one of ours or one the reader made
export default function TrackPage() {
  const { id } = useParams();
  const [own] = useTracks();
  const ours = trackById(id);
  if (ours) return <TrackView track={ours} kind="ours" />;
  const mine = own.find((t) => t.id === id);
  if (mine) return <TrackView track={toTrack(mine)} kind="own" />;
  return <NotFoundPage />;
}

// /tracks/shared?t=…, a track someone shared: everything it needs is in the link
export function SharedTrackPage() {
  const [params] = useSearchParams();
  const code = params.get("t") ?? "";
  const held = useHeld(sharedSlugs(code));
  if (!held) return <LoadingSpinner />;
  const track = decodeTrack(code);
  if (!track) return <NotFoundPage />;
  return <TrackView track={track} kind="shared" code={code} />;
}
