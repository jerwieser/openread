import { Button, Col, Container, Row } from "react-bootstrap";
import { Link } from "react-router-dom";

import BookCard from "../components/BookCard.jsx";
import Icon from "../components/Icon.jsx";
import { DeskBanner, FollowTheTrack, PickABook, ReadItTogether, TalkItThrough } from "../components/Illustrations.jsx";
import {
  BookCardPlaceholder, GridPlaceholder, Loader, LoadingSpinner, TrackCardPlaceholder,
  lazyPage,
} from "../components/Loading.jsx";
import { BOOK_GRID, TRACK_GRID } from "../components/grids.js";
import { SectionHeader, SeeAll, usePageTitle } from "../components/PageHeader.jsx";
import TagSearchDemo from "../components/TagSearchDemo.jsx";
import TrackCard from "../components/TrackCard.jsx";
import { bookBySlug, useBooks } from "../data/books.js";
import { DIFFICULTY } from "../data/catalogue.js";
import { readingTracks, trackById, trackTags } from "../data/tracks.js";
import { useCatalogue, useReaders, useUser } from "../store.js";

const STEPS = [
  [PickABook, "Pick a track", "Choose a subject you want to know more about, from the classics to a hobby, and put its books on your bookshelf in one go."],
  [TalkItThrough, "Ask other readers", "Stuck on a passage, or curious what comes next? Ask someone who has read the book, or the whole track."],
  [ReadItTogether, "Reflect and share", "Write a reflection on what stayed with you, and pass your track on to a friend with a link."],
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

// what OpenRead has that Goodreads doesn't, in a few words each
const DIFFERENT = ["No books to sell", "No ads", "No multinational"];

// One band of the page; the page alternates white ones and ones on its gray (layout.css), so each
// reads as its own. The cards in a white band keep their border and shadow to stand out.
function Section({ white, label, children }) {
  return (
    <section aria-label={label} className={`py-5 ${white ? "bg-body border-top border-bottom" : ""}`}>
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

// the press strip, its code loaded with the section
const FeaturedIn = lazyPage(() => import("../components/FeaturedIn.jsx"));

// A taste of the reading tracks comes first, as the heart of the site; then how it works, why
// OpenRead rather than Goodreads, a shelf of books to start with, what readers wrote afterwards and,
// last, the press and the call to make a track of your own.
export default function HomePage() {
  usePageTitle("Read great books together");
  const loaded = useCatalogue() === "loaded";
  const user = useUser();
  const books = useBooks();
  const readers = useReaders();
  // a first shelf: the approachable books with a cover that most readers have read
  const startHere = books
    .filter((b) => b.difficulty === "approachable" && b.cover)
    .map((b) => [b.slug, readers.filter((r) => r.read.includes(b.slug)).length])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 9)
    .map(([slug]) => slug);
  const tracks = readingTracks();
  const featured = FEATURED_TRACKS.map(trackById).filter(Boolean);
  const highlights = [`${tracks.length} reading tracks`, `${trackTags().length} tags`];

  // in page order; the backgrounds alternate by position, so the order can change freely
  const sections = [
    [
      "Reading tracks",
      <>
        <SectionHeader title="Reading tracks" link={<SeeAll to="/discover">{loaded ? `All ${tracks.length} tracks` : "All tracks"}</SeeAll>}>
          A handful of books, in order, that take you into one subject. Put a whole track on your bookshelf in one go.
        </SectionHeader>
        {/* the most used tags, each opening the tracks page with it */}
        <div className="d-flex flex-wrap justify-content-center gap-2 mb-5">
          {loaded ? (
            trackTags()
              .slice(0, 8)
              .map(({ tag }) => (
                <Button key={tag} as={Link} to={`/discover?tags=${encodeURIComponent(tag)}`} variant="outline-secondary" size="sm" className="rounded-pill px-3">
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
        <SectionHeader title="How it works">From picking a track to the last page, in three steps.</SectionHeader>
        <Row className="gy-4 gx-lg-5 text-center">
          {STEPS.map(([Art, title, text], i) => (
            <Col md={4} key={title}>
              <Art className="mx-auto" style={{ maxWidth: 120 }} />
              <h3 className="h5 mt-3">
                <span className="text-body-secondary me-1">{i + 1}.</span>
                {title}
              </h3>
              <p className="text-body-secondary mb-0">{text}</p>
            </Col>
          ))}
        </Row>
      </>,
    ],
    [
      "Why OpenRead",
      <>
        <SectionHeader title="An alternative to Goodreads">
          We don't sell you books, we help you read the right ones.
        </SectionHeader>
        <ul className="list-unstyled d-flex flex-wrap justify-content-center column-gap-5 row-gap-2 fs-5 fw-medium mb-0">
          {DIFFERENT.map((point) => (
            <li key={point} className="d-flex align-items-center gap-2">
              <Icon name="check-circle-fill" className="text-success" />
              {point}
            </li>
          ))}
        </ul>
        {/* for visitors without an account: not for readers who are logged in, and not before it's known
            whether someone is */}
        {loaded && !user && (
          <div className="text-center mt-4">
            <Button as={Link} to="/sign-up" size="lg" className="px-4">
              Sign up now
            </Button>
          </div>
        )}
      </>,
    ],
    [
      "Start here",
      <>
        <SectionHeader title="Start here" link={<SeeAll to="/books?difficulty=approachable">All approachable books</SeeAll>}>
          Short, gripping and a good first step. {DIFFICULTY.approachable.why}
        </SectionHeader>
        {loaded ? <BookRow slugs={startHere} /> : <BookRowPlaceholder />}
      </>,
    ],
    [
      "As featured in",
      <Loader key="featured" fallback={<LoadingSpinner label="Loading the press…" minHeight="16rem" />}>
        <FeaturedIn />
      </Loader>,
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
            The right books,
            <br className="d-none d-sm-inline" /> in the right order.
          </h1>
          <div className="col-lg-6 mx-auto">
            <p className="lead text-body-secondary mb-4">
              Pick a subject you want to know more about and follow its reading track, a handful of books chosen to take
              you into it. Then talk it over with readers who have read them.
            </p>
            {/* how finding a track works, played over and over: tags typed, picked and the tracks found */}
            <TagSearchDemo />
            <div className="d-grid gap-2 d-sm-flex justify-content-sm-center mb-3">
              <Button as={Link} to="/discover" size="lg" className="px-4 me-sm-3">
                Explore reading tracks
              </Button>
              <Button as={Link} to="/tracks/new" size="lg" variant="outline-secondary" className="px-4">
                Create a track
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

      {/* the heroes example's "dark color hero", in the site's blue; the desk scene's wall is the same
          blue, so the text sits on the wall above the desk and its well-read, annotated book */}
      <section aria-label="Make a track" className="bg-primary text-white text-center">
        <Container className="pt-5">
          <div className="pt-lg-5 pb-4">
            <h2 className="display-5 fw-bold text-white">Know a subject inside out?</h2>
            <div className="col-lg-6 mx-auto">
              <p className="fs-5 mb-4 opacity-75">
                Make a track of it: pick the books that taught you the most, put them in order and share the link.
                It&apos;s the best way to pass on what you love, to a friend or to anyone who&apos;s curious.
              </p>
              <div className="d-grid gap-2 d-sm-flex justify-content-sm-center">
                <Button as={Link} to="/tracks/new" size="lg" variant="light" className="px-4 me-sm-3 fw-bold">
                  Create a track
                </Button>
                <Button as={Link} to="/discover" size="lg" variant="outline-light" className="px-4">
                  Browse the tracks
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
