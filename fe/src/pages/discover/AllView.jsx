// Discover's All view, its first: tracks and books together.
//
// Without a search: tracks picked for the reader from their bookshelf, a few of our tracks, and a
// shelf of popular books for each category, each leading on to its own view. With a search, in the
// order a reader most likely wants them: the tracks about it, the books on OpenRead, the tracks those
// books are on (alternatives the words didn't find), then Open Library's books that aren't here yet. A
// line at the top says how many of each there are and jumps to them; the topics spelt like what was
// typed come under the search, so a typo or a broad word still has somewhere to go.
import { useMemo } from "react";
import { Button, Col, Row, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";

import BookCard from "../../components/BookCard.jsx";
import Icon, { IconCircle } from "../../components/Icon.jsx";
import { BookCardPlaceholder, GridPlaceholder } from "../../components/Loading.jsx";
import { CATEGORIES } from "../../data/catalogue.js";
import { readingTracks } from "../../data/tracks.js";
import { useFollows, useStatuses, useUser } from "../../store.js";
import { CategoryShelf, RecentShelf, plural } from "./BooksView.jsx";
import { closeTopics, findTracks, tracksForShelf, tracksWithBooks } from "./discover.js";
import { BOOKS, SectionTitle, SeeAllButton, TopicChip, TrackRow } from "./parts.jsx";
import { NotHereYet, useFoundBooks } from "./search.jsx";

const TRACKS_SHOWN = 3;
const BOOKS_SHOWN = 12; // two rows from 768px up, more below

const jump = (id) => document.getElementById(id)?.scrollIntoView();

export default function AllView({ params, show, onOpen, onTopic }) {
  const query = params.get("q") ?? "";
  const { typed, books, searching } = useFoundBooks(query);
  return typed.length >= 2 ? (
    <Results typed={typed} books={books} searching={searching} show={show} onOpen={onOpen} onTopic={onTopic} />
  ) : (
    <Browse show={show} onOpen={onOpen} />
  );
}

// --- without a search

function Browse({ show, onOpen }) {
  const user = useUser();
  const [statuses] = useStatuses();
  const [follows] = useFollows();
  const forYou = user ? tracksForShelf(statuses, follows) : [];
  const because = new Map(forYou.map(({ track, because: book }) => [track.id, book]));
  const featured = readingTracks()
    .filter((t) => !because.has(t.id))
    .slice(0, TRACKS_SHOWN);

  return (
    <>
      {forYou.length > 0 && (
        <section className="mb-5">
          <SectionTitle icon="star" tone="warning" title="Picked for you">
            Tracks with books from your bookshelf.
          </SectionTitle>
          <TrackRow
            tracks={forYou.map(({ track }) => track)}
            why={(t) => (
              <>
                <Icon name="bookmark-fill" className="text-primary me-1" />
                Has <i>{because.get(t.id).title}</i>, which is on your shelf
              </>
            )}
          />
        </section>
      )}

      {featured.length > 0 && (
        <section className="mb-5">
          <SectionTitle
            icon="signpost-split"
            tone="success"
            title="Reading tracks"
            count={readingTracks().length}
            action={<SeeAllButton onClick={() => show("tracks")}>All tracks</SeeAllButton>}
          >
            A handful of books, in order, that take you into one subject.
          </SectionTitle>
          <TrackRow tracks={featured} />
        </section>
      )}

      <RecentShelf onOpen={onOpen} onSeeAll={() => show("books", { sort: "added" })} />
      {CATEGORIES.map((c) => (
        <CategoryShelf key={c.id} category={c} onOpen={onOpen} onSeeAll={() => show("books", { category: c.id })} />
      ))}

      <MissingSomething />
    </>
  );
}

// the way on when the reader didn't find it: suggest a book, make a track, bring their own shelf
function MissingSomething({ query = "" }) {
  const title = query ? `?title=${encodeURIComponent(query)}` : "";
  return (
    <aside className="bg-body rounded-4 shadow-sm p-4 p-md-5 mt-5 text-center">
      <h2 className="h4 fw-bold text-body-emphasis">Can&apos;t find what you&apos;re after?</h2>
      <p className="text-body-secondary col-lg-7 mx-auto">
        Suggest a book and we&apos;ll add it, put together a track of your own, or bring the books you&apos;ve read from another site.
      </p>
      <div className="d-flex flex-wrap justify-content-center gap-2">
        <Button as={Link} to={`/books/suggest${title}`} variant="primary">
          Suggest a book
        </Button>
        <Button as={Link} to={`/tracks/new${title}`} variant="outline-primary">
          Make a track
        </Button>
        <Button as={Link} to="/import" variant="outline-secondary">
          Import my books
        </Button>
      </div>
    </aside>
  );
}

// --- a search

function Results({ typed, books, searching, show, onOpen, onTopic }) {
  const tracks = useMemo(() => findTracks(typed), [typed]);
  const related = useMemo(() => tracksWithBooks(books.slice(0, 30), tracks), [books, tracks]);
  const near = useMemo(() => closeTopics(typed), [typed]);
  const nothing = !searching && !tracks.length && !books.length;
  const bookCount = plural(books.length, books.length >= 100 ? "100+" : null);

  return (
    <>
      {/* what there is, each a jump to its section */}
      <nav className="d-flex flex-wrap justify-content-center align-items-center gap-2 small mb-4" aria-label="Results" aria-live="polite">
        {searching && <Spinner animation="border" size="sm" role="status" aria-label="Searching" />}
        <Button variant="light" size="sm" className="rounded-pill border" disabled={!tracks.length} onClick={() => jump("found-tracks")}>
          <Icon name="signpost-split" className="me-1" />
          {tracks.length} {tracks.length === 1 ? "track" : "tracks"}
        </Button>
        <Button variant="light" size="sm" className="rounded-pill border" disabled={!books.length} onClick={() => jump("found-books")}>
          <Icon name="bookmarks" className="me-1" />
          {bookCount}
        </Button>
        <Button variant="light" size="sm" className="rounded-pill border" onClick={() => jump("open-library")}>
          <Icon name="search" className="me-1" />
          More on Open Library
        </Button>
      </nav>

      {near.length > 0 && (
        <div className="d-flex flex-wrap justify-content-center align-items-center gap-2 mb-5">
          <span className="small text-body-secondary">{nothing ? "Did you mean" : "Topics"}</span>
          {near.map((topic) => (
            <TopicChip key={`${topic.kind}-${topic.id}`} topic={topic} onClick={() => onTopic(topic)} />
          ))}
        </div>
      )}

      {nothing && (
        <div className="text-center pb-3">
          <IconCircle name="search" size={72} tone="secondary" />
          <p className="lead mt-3 mb-1">Nothing on OpenRead for “{typed}” yet.</p>
          <p className="text-body-secondary">Open Library may have it: see below, and add it to your shelf in one click.</p>
        </div>
      )}

      {tracks.length > 0 && (
        <section className="mb-5">
          <SectionTitle
            id="found-tracks"
            icon="signpost-split"
            tone="success"
            title="Reading tracks"
            count={tracks.length}
            action={tracks.length > TRACKS_SHOWN && <SeeAllButton onClick={() => show("tracks")}>All {tracks.length}</SeeAllButton>}
          />
          <TrackRow tracks={tracks.slice(0, TRACKS_SHOWN)} />
        </section>
      )}

      {(books.length > 0 || searching) && (
        <section className="mb-5">
          <SectionTitle
            id="found-books"
            icon="bookmarks"
            tone="primary"
            title="Books"
            count={searching && !books.length ? null : books.length >= 100 ? "100+" : books.length}
            action={books.length > BOOKS_SHOWN && <SeeAllButton onClick={() => show("books")}>All {bookCount}</SeeAllButton>}
          >
            Tap a book for a closer look, or the bookmark to put it on Want to read.
          </SectionTitle>
          {books.length ? (
            <Row {...BOOKS}>
              {books.slice(0, BOOKS_SHOWN).map((b) => (
                <Col key={b.slug}>
                  <BookCard book={b} onOpen={onOpen} />
                </Col>
              ))}
            </Row>
          ) : (
            <GridPlaceholder Item={BookCardPlaceholder} count={6} {...BOOKS} />
          )}
        </section>
      )}

      {related.length > 0 && (
        <section className="mb-5">
          <SectionTitle icon="compass" tone="info" title="Tracks with these books">
            Read one of them along with others on the same subject.
          </SectionTitle>
          <TrackRow
            tracks={related.map(({ track }) => track)}
            why={(t) => (
              <>
                With <i>{related.find((r) => r.track.id === t.id).because.title}</i>
              </>
            )}
          />
        </section>
      )}

      <NotHereYet query={typed} />
      {nothing && <MissingSomething query={typed} />}
    </>
  );
}
