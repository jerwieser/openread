import { Card, Col, Container, Nav, Row } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";

import { DifficultyBadge, EraBadge, SubtleBadge } from "../components/Badges.jsx";
import BookCard from "../components/BookCard.jsx";
import BookCover from "../components/BookCover.jsx";
import BookStatusButton, { OwnBookButton } from "../components/BookStatus.jsx";
import Editions, { useExpressions } from "../components/Editions.jsx";
import { BookCardPlaceholder, ItemCardPlaceholder, GridPlaceholder, Loader, LoadingSpinner } from "../components/Loading.jsx";
import { Note, SectionHeader, usePageTitle } from "../components/PageHeader.jsx";
import { OnYourTracks } from "../components/TrackFollow.jsx";
import { eraById, formatYear, useBook, useBooks, usePagedBooks } from "../data/books.js";
import { DIFFICULTY } from "../data/catalogue.js";
import { languageName } from "../data/languages.js";
import { tracksFor } from "../data/tracks.js";
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
  const expressions = useExpressions(slug);
  usePageTitle(book?.title);
  // the other books by its author (or any of its authors), the oldest first
  const authors = (book?.authors ?? []).map((p) => p.slug).join(",");
  const others = usePagedBooks(authors ? { author: authors, sort: "oldest" } : null, 13);
  if (book === undefined) return <LoadingSpinner />;
  if (!book) return <NotFoundPage />;

  const era = book.era && eraById(book.era);
  const tracks = tracksFor(book);
  const byAuthor = others.books.filter((b) => b.slug !== book.slug).slice(0, 12);
  // similar reads: other books of the same period and difficulty, for the books we've rated
  const sameEra = book.difficulty
    ? books.filter((b) => b.era === book.era && b.slug !== book.slug && b.difficulty === book.difficulty).slice(0, 6)
    : [];

  const links = [
    tracks.length > 0 && ["tracks", "Reading tracks", tracks.length],
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
          {book.source === "suggestion" && <SubtleBadge>Suggested</SubtleBadge>}
        </div>
        <h1 className="display-3 fw-bold text-body-emphasis mb-2" lang={book.titleLanguage}>
          {book.title}
        </h1>
        <p className="fs-3 mb-1">{book.author}</p>
        <OriginalTitle book={book} />
        {book.year != null && <p className="small text-body-secondary">First published {formatYear(book)}</p>}

        <div className="d-flex flex-wrap justify-content-center align-items-center gap-2 mt-4">
          <BookStatusButton book={book} />
          <OwnBookButton book={book} />
        </div>
        <OnYourTracks book={book} />
        {book.difficulty && (
          <Note title="How it reads">
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
