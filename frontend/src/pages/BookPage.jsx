import { Fragment } from "react";
import { Button, Card, Col, Container, Dropdown, Nav, Row } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";

import { useAskQuestion } from "../components/AskQuestion.jsx";
import { DifficultyBadge, EraBadge, SubtleBadge } from "../components/Badges.jsx";
import BookCard from "../components/BookCard.jsx";
import BookCover from "../components/BookCover.jsx";
import BookStatusButton from "../components/BookStatus.jsx";
import Editions, { useExpressions } from "../components/Editions.jsx";
import Initials from "../components/Initials.jsx";
import {
  BookCardPlaceholder, ItemCardPlaceholder, GridPlaceholder, Loader, LoadingSpinner, ReflectionCardPlaceholder,
} from "../components/Loading.jsx";
import { Note, SectionHeader, usePageTitle } from "../components/PageHeader.jsx";
import { ReaderName } from "../components/ReaderCard.jsx";
import ReflectionCard from "../components/ReflectionCard.jsx";
import { OnYourTracks } from "../components/TrackFollow.jsx";
import { eraById, formatYear, useBook, useBooks, usePagedBooks } from "../data/books.js";
import { DIFFICULTY } from "../data/catalogue.js";
import { languageName } from "../data/languages.js";
import { firstName, readersReading, readersWhoRead } from "../data/readers.js";
import { toReflection, usePublishedReflections } from "../data/reflections.js";
import { tracksFor } from "../data/tracks.js";
import { useReaders, useReflections, useUser } from "../store.js";
import NotFoundPage from "./NotFoundPage.jsx";

// One track the book is on: the track's picture, where the book comes in it, a dot for each book
// with this one marked, and the books either side of it
function TrackStop({ track, book }) {
  const i = track.books.findIndex((s) => s.book === book);
  const prev = track.books[i - 1]?.book;
  const next = track.books[i + 1]?.book;
  return (
    <Card className="h-100 shadow-sm overflow-hidden">
      <div className="d-flex h-100">
        <div
          className="flex-shrink-0 bg-body-secondary"
          style={{ width: 96, backgroundImage: `url("${track.image}")`, backgroundSize: "cover", backgroundPosition: "center bottom" }}
          aria-hidden="true"
        />
        <Card.Body>
          <div className="small text-body-secondary">
            Book {i + 1} of {track.books.length}
            {track.books[i].window && track.books[i].window !== book.title && ` · canon window “${track.books[i].window}”`}
          </div>
          <Card.Title as="h3" className="h6 fw-bold mb-2">
            <Link to={`/tracks/${track.id}`} className="link-body-emphasis text-decoration-none">
              {track.title}
            </Link>
          </Card.Title>
          {track.books[i].note && <p className="small text-body-secondary mb-2">{track.books[i].note}</p>}
          <div className="d-flex gap-1 mb-2" aria-hidden="true">
            {track.books.map((s, n) => (
              <span
                key={s.book.slug}
                className={`rounded-pill ${n === i ? "bg-primary" : n < i ? "bg-primary-subtle" : "bg-body-secondary"}`}
                style={{ height: 6, flex: 1 }}
              />
            ))}
          </div>
          <div className="small d-flex flex-wrap justify-content-between column-gap-3">
            {prev ? (
              <Link to={`/books/${prev.slug}`} className="link-secondary">
                ← {prev.title}
              </Link>
            ) : (
              <span className="text-body-secondary">Starts the track</span>
            )}
            {next ? (
              <Link to={`/books/${next.slug}`} className="link-secondary">
                {next.title} →
              </Link>
            ) : (
              <span className="text-body-secondary">Ends the track</span>
            )}
          </div>
        </Card.Body>
      </div>
    </Card>
  );
}

// The readers of the book, compactly: per group a row of overlapping avatars, each a link to the
// reader's profile, then the count and the first names
const FACES = 6;
const FACE = 44;
// a ring in the page's background colour keeps overlapping avatars apart
const RING = { boxShadow: "0 0 0 3px var(--bs-body-bg)", marginInlineStart: -8 };

function Faces({ readers }) {
  const more = readers.length - FACES;
  return (
    <div className="d-flex justify-content-center mb-2" style={{ paddingInlineStart: 8 }}>
      {readers.slice(0, FACES).map((r) => (
        <Link key={r.id} to={`/readers/${r.id}`} title={r.name} className="rounded-circle d-inline-flex" style={RING}>
          <Initials name={r.name} photo={r.photo} size={FACE} />
          <span className="visually-hidden">{r.name}</span>
        </Link>
      ))}
      {more > 0 && (
        <span className="rounded-circle d-inline-flex align-items-center justify-content-center bg-body-secondary small fw-semibold" style={{ ...RING, width: FACE, height: FACE }}>
          +{more}
        </span>
      )}
    </div>
  );
}

// "Marcus Bell and Jonas Lind", or "Marcus Bell, Jonas Lind and 3 more"
function Names({ readers }) {
  const shown = readers.slice(0, 2);
  const more = readers.length - shown.length;
  return (
    <>
      {shown.map((r, i) => (
        <Fragment key={r.id}>
          {i > 0 && (more ? ", " : " and ")}
          <ReaderName reader={r} className="text-decoration-none" />
        </Fragment>
      ))}
      {more > 0 && ` and ${more} more`}
    </>
  );
}

function ReaderGroup({ title, readers, children }) {
  return (
    <div className="text-center">
      <Faces readers={readers} />
      <div className="fw-semibold">
        {title} <span className="fw-normal text-body-secondary">({readers.length})</span>
      </div>
      <div className="small text-body-secondary">
        <Names readers={readers} />
      </div>
      {children}
    </div>
  );
}

// Asking someone who has read the book about it: straight away when there's one, else pick from a menu
function AskReader({ readers, book }) {
  const askQuestion = useAskQuestion();
  const user = useUser();
  const others = readers.filter((r) => !user || r.id !== user.id);
  if (!others.length) return null;
  if (others.length === 1) {
    return (
      <Button size="sm" variant="outline-primary" className="mt-2" onClick={() => askQuestion({ reader: others[0], book })}>
        Ask {firstName(others[0])} about it
      </Button>
    );
  }
  return (
    <Dropdown className="mt-2">
      <Dropdown.Toggle size="sm" variant="outline-primary">
        Ask one of them
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {others.map((r) => (
          <Dropdown.Item key={r.id} as="button" className="d-flex align-items-center gap-2" onClick={() => askQuestion({ reader: r, book })}>
            <Initials name={r.name} photo={r.photo} size={24} />
            {r.name}
          </Dropdown.Item>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

// a row of grey avatars and a line under it, for each group still loading
function ReadersPlaceholder({ groups }) {
  return (
    <div className="d-flex flex-wrap justify-content-center gap-5 placeholder-glow">
      {Array.from({ length: groups }, (_, i) => (
        <div key={i} className="text-center" style={{ width: 160 }}>
          <div className="d-flex justify-content-center mb-2" style={{ paddingInlineStart: 8 }}>
            {[0, 1, 2].map((n) => (
              <span key={n} className="placeholder rounded-circle" style={{ ...RING, width: FACE, height: FACE }} />
            ))}
          </div>
          <span className="placeholder col-8 d-block mx-auto mb-2" />
          <span className="placeholder placeholder-sm col-10 d-block mx-auto" />
        </div>
      ))}
    </div>
  );
}

// a section the links below jump to stops a little under the top of the screen
const JUMPED = { scrollMarginTop: "2rem" };

// Links to the page's sections, centred under the top, so a long page is quick to get around
function SectionLinks({ links }) {
  return (
    <Nav className="justify-content-center border-top border-bottom py-2 mt-5 small">
      {links.map(([id, label, count]) => (
        <Nav.Link key={id} href={`#${id}`} className="link-body-emphasis">
          {label}
          {count != null && <span className="text-body-secondary"> ({count})</span>}
        </Nav.Link>
      ))}
    </Nav>
  );
}

// the title it was written under, when that isn't the one the reader sees: "Dutch original: De donkere
// kamer van Damokles"
function OriginalTitle({ book }) {
  const language = book.language && languageName(book.language);
  if (!language || !book.originalTitle || book.originalTitle === book.title) return null;
  return (
    <p className="text-body-secondary mb-1">
      {language} original: <i lang={book.language}>{book.originalTitle}</i>
    </p>
  );
}

export default function BookPage() {
  const books = useBooks();
  const { slug } = useParams();
  // asked for when the site doesn't hold it, as when the page is opened from a link
  const book = useBook(slug);
  const published = usePublishedReflections();
  const [own] = useReflections();
  const expressions = useExpressions(slug);
  useReaders(); // the lists of readers below include the reader's own marks
  usePageTitle(book?.title);
  // the other books by its author (or any of its authors), the oldest first
  const authors = (book?.authors ?? []).map((p) => p.slug).join(",");
  const others = usePagedBooks(authors ? { author: authors, sort: "oldest" } : null, 13);
  if (book === undefined) return <LoadingSpinner />;
  if (!book) return <NotFoundPage />;

  const era = book.era && eraById(book.era);
  const tracks = tracksFor(book);
  // the most widely read first: they can say how this book fits with the others
  const byBooksRead = (a, b) => b.read.length - a.read.length;
  const read = readersWhoRead(book).toSorted(byBooksRead);
  const reading = readersReading(book).toSorted(byBooksRead);
  // the reader's own drafts of one first, which only they see, then everyone's published ones
  const drafts = own.filter((r) => r.bookSlug === book.slug && r.status === "draft").map(toReflection);
  const reflections = [...drafts, ...published.filter((r) => r.book === book.slug)];
  const byAuthor = others.books.filter((b) => b.slug !== book.slug).slice(0, 12);
  // similar reads: other books of the same period and difficulty, for the books we've rated
  const sameEra = book.difficulty
    ? books.filter((b) => b.era === book.era && b.slug !== book.slug && b.difficulty === book.difficulty).slice(0, 6)
    : [];

  const links = [
    tracks.length > 0 && ["tracks", "Reading tracks", tracks.length],
    ["readers", "Readers", read.length + reading.length],
    ["reflections", "Reflections", reflections.length],
    ["editions", "Languages and editions", expressions?.length],
    byAuthor.length > 0 && ["by-author", `More by ${book.author}`],
    sameEra.length > 0 && ["similar", "Similar reads"],
  ].filter(Boolean);

  // One centred column, like the rest of the site: the book at the top, links to each section, then
  // the sections one under the other
  return (
    <Container className="py-5">
      {/* the book in one centred column, like the heroes on the other pages. What matters most is
          biggest: the cover, the title and author, and the one main action; the small print (badges,
          year, where the reader is with it, why read it together) is small and grey */}
      <header className="text-center">
        <BookCover book={book} size="hero" className="mx-auto mb-4" />
        <div className="d-flex flex-wrap justify-content-center gap-2 mb-3">
          <DifficultyBadge level={book.difficulty} labelled />
          <EraBadge era={book.era} />
          {book.source === "suggestion" && <SubtleBadge tone="info">Added by readers</SubtleBadge>}
        </div>
        <h1 className="display-3 fw-bold text-body-emphasis mb-2" lang={book.titleLanguage}>
          {book.title}
        </h1>
        <p className="fs-3 mb-1">{book.author}</p>
        <OriginalTitle book={book} />
        {book.year != null && <p className="small text-body-secondary">First published {formatYear(book)}</p>}

        {read.length + reading.length > 0 && (
          <Button href="#readers" size="lg" className="px-5 mt-3">
            Talk to its readers
          </Button>
        )}
        <div className="d-flex flex-wrap justify-content-center align-items-center gap-2 mt-3">
          <BookStatusButton book={book} size="sm" />
        </div>
        <OnYourTracks book={book} />
        {book.difficulty && (
          <Note title="Why read it together">
            <p className="mb-1">
              <b>{DIFFICULTY[book.difficulty].label}.</b> {DIFFICULTY[book.difficulty].why}
            </p>
            {era && <p className="mb-0">{era.note}</p>}
          </Note>
        )}
      </header>

      <SectionLinks links={links} />

      {tracks.length > 0 && (
        <section className="mt-5" id="tracks" style={JUMPED}>
          <SectionHeader title={tracks.length === 1 ? "On a reading track" : `On ${tracks.length} reading tracks`}>
            Where {book.title} comes in each series, and what to read before and after it.
          </SectionHeader>
          <Loader key={book.slug} fallback={<GridPlaceholder Item={ItemCardPlaceholder} count={tracks.length} xs={1} md={2} className="g-4 justify-content-center" />}>
            <Row xs={1} md={2} className="g-4 justify-content-center">
              {tracks.map((t) => (
                <Col key={t.id}>
                  <TrackStop track={t} book={book} />
                </Col>
              ))}
            </Row>
          </Loader>
        </section>
      )}

      <section className="mt-5" id="readers" style={JUMPED}>
        <SectionHeader title="Readers">
          {read.length && reading.length
            ? `Who has read ${book.title} and can answer your questions, and who is reading it now and might like to compare notes.`
            : read.length
              ? `Who has read ${book.title} and can answer your questions.`
              : reading.length
                ? `Who is reading ${book.title} now and might like to compare notes. Nobody has marked it as read yet.`
                : `Nobody has marked ${book.title} as read or reading yet. Mark it above, and other readers can find you here.`}
        </SectionHeader>
        {read.length + reading.length > 0 && (
          <Loader key={book.slug} fallback={<ReadersPlaceholder groups={(read.length > 0) + (reading.length > 0)} />}>
            <div className="d-flex flex-wrap justify-content-center column-gap-5 row-gap-4">
              {read.length > 0 && (
                <ReaderGroup title="Have read it" readers={read}>
                  <AskReader readers={read} book={book} />
                </ReaderGroup>
              )}
              {reading.length > 0 && (
                <ReaderGroup title="Reading it now" readers={reading}>
                  <AskReader readers={reading} book={book} />
                </ReaderGroup>
              )}
            </div>
          </Loader>
        )}
      </section>

      <section className="mt-5" id="reflections" style={JUMPED}>
        <SectionHeader
          title="Reflections"
          link={
            <Button as={Link} to={`/reflections/new?book=${book.slug}`} variant="outline-primary">
              Write a reflection
            </Button>
          }
        >
          {reflections.length
            ? `What readers took from ${book.title}.`
            : `Nobody has written about ${book.title} yet. Once you've read it, you could be the first.`}
        </SectionHeader>
        {reflections.length > 0 && (
          <Loader key={book.slug} fallback={<GridPlaceholder Item={ReflectionCardPlaceholder} count={Math.min(reflections.length, 2)} xs={1} lg={2} className="g-4 justify-content-center" />}>
            <Row xs={1} lg={2} className="g-4 justify-content-center">
              {reflections.map((r) => (
                <Col key={r.id}>
                  <ReflectionCard reflection={r} showBook={false} />
                </Col>
              ))}
            </Row>
          </Loader>
        )}
      </section>

      <section className="mt-5" id="editions" style={JUMPED}>
        <SectionHeader title="Languages and editions">
          {expressions?.length > 1
            ? `${book.title} in each language it's in, and the editions of it we know of.`
            : `${book.title} and the editions of it we know of.`}
        </SectionHeader>
        <Editions book={book} expressions={expressions} />
      </section>

      {byAuthor.length > 0 && (
        <section className="mt-5" id="by-author" style={JUMPED}>
          <SectionHeader title={`Other books by ${book.author}`}>
            {byAuthor.length === 1 ? "One more of their books on OpenRead." : "More of their books on OpenRead, the oldest first."}
          </SectionHeader>
          {/* like the similar reads below: up to six to a row in a narrower centred column */}
          <div className="mx-auto" style={{ maxWidth: "52rem" }}>
            <Loader key={book.slug} fallback={<GridPlaceholder Item={BookCardPlaceholder} count={byAuthor.length} xs={2} sm={3} md={6} className="g-3 justify-content-center" />}>
              <Row xs={2} sm={3} md={6} className="g-3 justify-content-center">
                {byAuthor.map((b) => (
                  <Col key={b.slug}>
                    <BookCard book={b} />
                  </Col>
                ))}
              </Row>
            </Loader>
          </div>
        </section>
      )}

      {sameEra.length > 0 && (
        <section className="mt-5" id="similar" style={JUMPED}>
          <SectionHeader title="Similar reads">
            Other {DIFFICULTY[book.difficulty].label.toLowerCase()} books from the same period ({era?.label}).
          </SectionHeader>
          {/* smaller than the book's own cover: up to six to a row in a narrower centred column, two on a phone */}
          <div className="mx-auto" style={{ maxWidth: "52rem" }}>
            <Loader key={book.slug} fallback={<GridPlaceholder Item={BookCardPlaceholder} count={sameEra.length} xs={2} sm={3} md={6} className="g-3 justify-content-center" />}>
              <Row xs={2} sm={3} md={6} className="g-3 justify-content-center">
                {sameEra.map((b) => (
                  <Col key={b.slug}>
                    <BookCard book={b} />
                  </Col>
                ))}
              </Row>
            </Loader>
          </div>
        </section>
      )}
    </Container>
  );
}
