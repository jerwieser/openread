import { useState } from "react";
import { Button, Card, Col, Container, Form, InputGroup, Row } from "react-bootstrap";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import BusyButton from "../components/BusyButton.jsx";
import { GridPlaceholder, Loader, LoadingSpinner, ReaderCardPlaceholder, lazyPage } from "../components/Loading.jsx";
import { useMessage } from "../components/Messages.jsx";
import { SectionHeader, usePageTitle } from "../components/PageHeader.jsx";
import { TrackShelf, trackSpan } from "../components/TrackCard.jsx";
import { FollowCard, useTrackFollow } from "../components/TrackFollow.jsx";
import ReaderCard from "../components/ReaderCard.jsx";
import { readersWhoKnow } from "../data/readers.js";
import { useHeld } from "../data/books.js";
import { decodeTrack, encodeTrack, sharedSlugs, toTrack, trackById } from "../data/tracks.js";
import { useTracks } from "../store.js";
import NotFoundPage from "./NotFoundPage.jsx";

// the winding shelf of books, the biggest part of the page, loaded on its own
const TrackPath = lazyPage(() => import("../components/TrackPath.jsx"));

const LABEL = { ours: "Reading track", own: "Your reading track", shared: "Shared reading track" };

// the link that carries the track, to copy or hand to the phone's share sheet
function ShareCard({ track }) {
  const link = `${window.location.origin}/tracks/shared?t=${encodeTrack(track)}`;
  const message = useMessage();
  async function copy(e) {
    const field = e.currentTarget.previousElementSibling;
    try {
      await navigator.clipboard.writeText(link);
      message("The link is copied. Paste it anywhere to share the track.");
    } catch {
      field.select(); // no clipboard access: select the link so it can be copied with the keyboard
      message("Your browser wouldn't let us copy it, so the link is selected: press Ctrl+C (⌘C on a Mac) to copy it.", "warning");
    }
  }
  return (
    <Card className="shadow-sm mt-3">
      <Card.Body className="p-4">
        <h2 className="h6">Share this track</h2>
        <p className="small text-body-secondary">
          Anyone with the link can see the track and add its books to their own list, no account needed. The link
          holds the track as it is now, so share a new one after you edit it.
        </p>
        <InputGroup>
          <Form.Control readOnly value={link} onFocus={(e) => e.target.select()} aria-label="Link to this track" />
          <Button onClick={copy}>Copy link</Button>
        </InputGroup>
        {navigator.share && (
          <Button
            variant="link"
            size="sm"
            className="p-0 mt-2"
            onClick={() => navigator.share({ title: track.title, url: link }).catch(() => {})}
          >
            Share with an app…
          </Button>
        )}
      </Card.Body>
    </Card>
  );
}

// One track's page, for ours, the reader's own and shared ones: what it is, the card to follow it
// and see how far they are, the winding shelf of its books and the readers who know them, to ask
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
  const books = track.books.map((s) => s.book);
  // readers who have read at least two of the track's books, most first
  const readers = readersWhoKnow(books.map((b) => b.slug));
  const finished = readers.filter((r) => books.every((b) => r.read.includes(b.slug))).length;
  const copyFrom = kind === "ours" ? `from=${track.id}` : kind === "shared" ? `shared=${code}` : null;

  return (
    <Container className="py-5">
      <TrackShelf track={track} large className="rounded-4 border" />

      {/* the track in one centred column under its shelf, like the book page: the title and what it is,
          then the follow card, the books in order and the rest one under the other */}
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
        <div className="text-start mx-auto mt-4" style={{ maxWidth: "30rem" }}>
          {kind === "shared" ? (
            <p className="small text-body-secondary text-center">Save a copy to your tracks to follow it and keep your place.</p>
          ) : (
            <FollowCard track={track} />
          )}
          {kind === "own" && <ShareCard track={track} />}
        </div>

        <div className="d-flex flex-wrap justify-content-center align-items-center gap-3 mt-3">
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

      {readers.length > 0 && (
        <section className="mt-5">
          <SectionHeader title="Readers who know this track">
            {finished > 0
              ? `${finished === 1 ? "One reader has" : `${finished} readers have`} read every book on it, and the others several. Ask them anything.`
              : "Each has read several of these books. Ask them anything."}
          </SectionHeader>
          <Loader key={track.id} fallback={<GridPlaceholder Item={ReaderCardPlaceholder} count={Math.min(readers.length, 6)} xs={1} md={2} lg={3} className="g-4 justify-content-center" />}>
            <Row xs={1} md={2} lg={3} className="g-4 justify-content-center">
              {readers.slice(0, 6).map((r) => (
                <Col key={r.id}>
                  <ReaderCard reader={r} compact />
                </Col>
              ))}
            </Row>
          </Loader>
        </section>
      )}
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
