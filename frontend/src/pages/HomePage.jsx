import { Button, Col, Container, Row } from "react-bootstrap";
import { Link } from "react-router-dom";

import BookCard from "../components/BookCard.jsx";
import Icon from "../components/Icon.jsx";
import { DeskBanner, FollowTheTrack } from "../components/Illustrations.jsx";
import { BookCardPlaceholder, GridPlaceholder, Loader, TrackCardPlaceholder } from "../components/Loading.jsx";
import { BOOK_GRID, TRACK_GRID } from "../components/grids.js";
import { SectionHeader, SeeAll, usePageTitle } from "../components/PageHeader.jsx";
import TagSearchDemo from "../components/TagSearchDemo.jsx";
import TrackCard from "../components/TrackCard.jsx";
import { bookBySlug, useBooks } from "../data/books.js";
import { DIFFICULTY } from "../data/catalogue.js";
import { readingTracks, trackById, trackTags } from "../data/tracks.js";
import { useCatalogue } from "../store.js";

const STEPS = [
  ["1", "Explore a track", "Pick a subject you want to know more about. A track is a short list of books, already in the order to read them."],
  ["2", "Read them in order", "Start at the first book and follow the line. Each one prepares you for the next."],
  ["3", "Mark your place", "On every book, choose Want to read, Reading now, or Finished. Your bookshelf keeps the three apart."],
];

const STATUSES = [
  ["bookmark", "Want to read", "Books you mean to get to, including the next one on a track you follow.", "want"],
  ["eyeglasses", "Reading now", "The book you have open. One status, so you always know what you're in.", "reading"],
  ["check-circle", "Finished", "Books you've read to the end. Finishing one moves you along the track.", "finished"],
];

// a taste of the tracks, not the whole list: three different kinds, one row of the grid, the rest a
// click away
const FEATURED_TRACKS = ["french-revolution", "tour-de-france", "modern-art"];

// The home page shows straight away, before the catalogue is in (App.jsx, Opened): its words and
// pictures are its own. What comes from the API (the tracks, their tags, the books and the counts)
// shows these meanwhile, the shape of what's coming.
const TrackGridPlaceholder = () => (
  <GridPlaceholder Item={TrackCardPlaceholder} count={FEATURED_TRACKS.length} {...TRACK_GRID} />
);
const TagsPlaceholder = () => (
  <span className="placeholder-glow d-flex flex-wrap justify-content-center gap-2" aria-hidden="true">
    {Array.from({ length: 8 }, (_, i) => (
      <span key={i} className="placeholder rounded-pill bg-body-secondary" style={{ width: "5rem", height: "1.9rem" }} />
    ))}
  </span>
);

// One band of the page. The open bands stay on the dark field. The others are white, so the
// page is only dark and white and the cards still sit on a sheet of their own.
function Section({ white, label, children }) {
  return (
    <section aria-label={label} className={`py-5 ${white ? "bg-body" : ""}`}>
      <Container className="py-lg-3">{children}</Container>
    </section>
  );
}

// a shelf of books, one row of the grid: nine, the last three only from 1200px up, where the grid has
// nine columns; loading on its own with six covers' worth of placeholders
const BookRowPlaceholder = ({ count = 6 }) => (
  <GridPlaceholder Item={BookCardPlaceholder} count={count} {...BOOK_GRID} />
);

function BookRow({ slugs }) {
  return (
    <Loader fallback={<BookRowPlaceholder />}>
      <Row {...BOOK_GRID}>
        {slugs.map((s, i) => (
          <Col key={s} className={i >= 6 ? "d-none d-xl-block" : undefined}>
            <BookCard book={bookBySlug(s)} showcase />
          </Col>
        ))}
      </Row>
    </Loader>
  );
}

// Tracks first, then how to keep your place, then a shelf of single books. The page says the two
// things to do: explore a topic through a track, and mark what you want, what you're reading and
// what you've finished.
export default function HomePage() {
  usePageTitle("Explore a topic, track your reading");
  const loaded = useCatalogue() === "loaded";
  const books = useBooks();
  const startHere = books.filter((b) => b.difficulty === "approachable" && b.cover).slice(0, 9).map((b) => b.slug);
  const tracks = readingTracks();
  const featured = FEATURED_TRACKS.map(trackById).filter(Boolean);
  const highlights = [`${tracks.length} reading tracks`, `${trackTags().length} tags`];

  // in page order; the backgrounds alternate by position, so the order can change freely
  const sections = [
    [
      "Reading tracks",
      <>
        <SectionHeader title="Reading tracks" link={<SeeAll to="/discover?view=tracks">{loaded ? `All ${tracks.length} tracks` : "All tracks"}</SeeAll>}>
          Start here. Each track is one subject, a handful of books, in order.
        </SectionHeader>
        {/* the most used tags, each opening the tracks page with it */}
        <div className="d-flex flex-wrap justify-content-center gap-2 mb-5">
          {loaded ? (
            trackTags()
              .slice(0, 8)
              .map(({ tag }) => (
                <Button key={tag} as={Link} to={`/discover?view=tracks&tags=${encodeURIComponent(tag)}`} variant="outline-dark" size="sm" className="rounded-pill px-3 bg-white">
                  {tag}
                </Button>
              ))
          ) : (
            <TagsPlaceholder />
          )}
        </div>
        {loaded ? (
          <Loader fallback={<TrackGridPlaceholder />}>
            <Row {...TRACK_GRID}>
              {featured.map((t) => (
                <Col key={t.id}>
                  <TrackCard track={t} showcase />
                </Col>
              ))}
            </Row>
          </Loader>
        ) : (
          <TrackGridPlaceholder />
        )}
      </>,
    ],
    [
      "How it works",
      <>
        <SectionHeader title="What to do">Two jobs. Explore a topic, then keep track of the reading.</SectionHeader>
        <Row className="gy-4 gx-lg-5 text-center">
          {STEPS.map(([n, title, text]) => (
            <Col md={4} key={title}>
              <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-dark fw-bold" style={{ width: 48, height: 48 }}>
                {n}
              </div>
              <h3 className="h5 mt-3">{title}</h3>
              <p className="text-body-secondary mb-0">{text}</p>
            </Col>
          ))}
        </Row>
      </>,
    ],
    [
      "Your reading",
      <>
        <SectionHeader title="Track your reading" link={<SeeAll to="/bookshelf">Open your bookshelf</SeeAll>}>
          Every book is one of three. The bookshelf is where you see them.
        </SectionHeader>
        <Row className="gy-3 gx-lg-4">
          {STATUSES.map(([icon, title, text, shelf]) => (
            <Col md={4} key={shelf}>
              <Link to={`/bookshelf?shelf=${shelf}`} className="d-block h-100 p-4 bg-dark text-white text-decoration-none rounded-3">
                <Icon name={icon} className="fs-3" />
                <h3 className="h5 mt-3 text-white">{title}</h3>
                <p className="mb-0" style={{ color: "rgba(255, 255, 255, 0.75)" }}>{text}</p>
              </Link>
            </Col>
          ))}
        </Row>
      </>,
    ],
    [
      "A single book",
      <>
        <SectionHeader title="Or start with one book" link={<SeeAll to="/discover?view=books">All books</SeeAll>}>
          A track is the way in. A single book still belongs on your bookshelf. {DIFFICULTY.approachable.why}
        </SectionHeader>
        {loaded ? <BookRow slugs={startHere} /> : <BookRowPlaceholder />}
      </>,
    ],
  ];

  return (
    <>
      {/* Bootstrap's "centered screenshot" hero (getbootstrap.com/docs/5.3/examples/heroes): the text and
          buttons centred in the page's container like every other page, the picture centred under them and
          standing on the line where the next section starts. The picture is shown whole rather than cropped like the example's screenshot, so the
          readers on the staircase stay in view */}
      <section aria-label="Introduction" className="pt-5 text-center">
        <Container className="pt-lg-3">
          <h1 className="display-3 fw-bold text-body-emphasis col-lg-9 mx-auto mb-4">
            Explore a topic.
            <br className="d-none d-sm-inline" /> Track what you read.
          </h1>
          <div className="col-lg-7 mx-auto">
            <p className="lead text-body-secondary mb-4">
              Follow a reading track through a subject, one book after another. Mark each book Want to read, Reading now, or Finished.
            </p>
            {/* how finding a track works, played over and over: tags typed, picked and the tracks found */}
            <TagSearchDemo />
            <div className="d-grid gap-2 d-sm-flex justify-content-sm-center mb-3">
              <Button as={Link} to="/discover?view=tracks" size="lg" className="px-4 me-sm-3">
                Explore tracks
              </Button>
              <Button as={Link} to="/bookshelf" size="lg" variant="outline-light" className="px-4">
                Your bookshelf
              </Button>
            </div>
            <p className="small text-body-secondary mb-5 placeholder-glow">
              {loaded ? highlights.join(" · ") : <span className="placeholder col-4 bg-body-secondary" />}
            </p>
          </div>
          <FollowTheTrack className="mx-auto" style={{ maxWidth: 527 }} />
        </Container>
      </section>

      {sections.map(([label, content], i) => (
        <Section key={label} label={label} white={i % 2 === 0}>
          {content}
        </Section>
      ))}

      {/* the heroes example's "dark color hero"; the desk scene's wall is the same dark, so the
          text sits on the wall above the desk and its well-read, annotated book */}
      <section aria-label="Make a track" className="bg-dark text-white text-center">
        <Container className="pt-5">
          <div className="pt-lg-5 pb-4">
            <h2 className="display-5 fw-bold text-white">Know a subject well?</h2>
            <div className="col-lg-6 mx-auto">
              <p className="fs-5 mb-4 opacity-75">
                Put the books that taught you the most in order. That track is how someone else starts the same subject.
              </p>
              <div className="d-grid gap-2 d-sm-flex justify-content-sm-center">
                <Button as={Link} to="/discover?view=tracks" size="lg" variant="light" className="px-4 me-sm-3 fw-bold">
                  Explore tracks
                </Button>
                <Button as={Link} to="/tracks/new" size="lg" variant="outline-light" className="px-4">
                  Create a track
                </Button>
              </div>
            </div>
          </div>
        </Container>
        <DeskBanner />
      </section>
    </>
  );
}
