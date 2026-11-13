import { Button, Col, Container, ProgressBar, Row } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";

import { useAskQuestion } from "../components/AskQuestion.jsx";
import { SubtleBadge } from "../components/Badges.jsx";
import BookCard from "../components/BookCard.jsx";
import Initials from "../components/Initials.jsx";
import { BookCardPlaceholder, GridPlaceholder, ListPlaceholder, Loader } from "../components/Loading.jsx";
import { BOOK_GRID } from "../components/grids.js";
import { SectionHeader, usePageTitle } from "../components/PageHeader.jsx";
import { bookBySlug } from "../data/books.js";
import { languageName } from "../data/languages.js";
import { aboutLine, firstName, readerById } from "../data/readers.js";
import { readingTracks, trackById } from "../data/tracks.js";
import { useReaders, useUser } from "../store.js";
import NotFoundPage from "./NotFoundPage.jsx";

// a row of books, loading on its own with cover-shaped placeholders
function BookRow({ slugs }) {
  const { id } = useParams();
  const books = slugs.map(bookBySlug).filter(Boolean);
  return (
    <Loader key={id} fallback={<GridPlaceholder Item={BookCardPlaceholder} count={Math.min(books.length, 6)} {...BOOK_GRID} />}>
      <Row {...BOOK_GRID}>
        {books.map((b) => (
          <Col key={b.slug}>
            <BookCard book={b} />
          </Col>
        ))}
      </Row>
    </Loader>
  );
}

// A reader's profile: who they are, what they're reading and
// have read and the tracks they know best. On their own profile, readers get a link to edit it
// instead of the button to ask a question.
export default function ReaderPage() {
  const { id } = useParams();
  useReaders(); // a profile follows its edits and its books
  const reader = readerById(id);
  const user = useUser();
  const askQuestion = useAskQuestion();
  usePageTitle(reader?.name);
  if (!reader) return <NotFoundPage />;

  const me = Boolean(user && reader.id === user.id);
  // the tracks they completed or follow, then the ones they've read at least three books of, the most
  // read first
  const kept = (track) => (reader.completed.includes(track.id) ? "completed" : reader.following.includes(track.id) ? "following" : null);
  const RANK = { completed: 2, following: 1 };
  // retired tracks only count when they keep them
  const tracks = [...readingTracks(), ...[...reader.following, ...reader.completed].map(trackById).filter((t) => t?.retired)];
  const known = tracks.map((track) => ({ track, kept: kept(track), count: track.books.filter((s) => reader.read.includes(s.book.slug)).length }))
    .filter(({ count, kept }) => kept || count >= 3)
    .sort((a, b) => (RANK[b.kept] ?? 0) - (RANK[a.kept] ?? 0) || b.count / b.track.books.length - a.count / a.track.books.length)
    .slice(0, 6);
  const finished = known.filter(({ track, kept, count }) => kept === "completed" || count === track.books.length).length;
  const name = me ? "you" : firstName(reader);

  return (
    <Container className="py-5">
      {/* who they are in one centred column, like the book page: the avatar, the name and the one main
          action big; the facts, the bio and what they know smaller underneath */}
      <header className="text-center">
        <div className="d-flex justify-content-center mb-4">
          <Initials name={reader.name} photo={reader.photo} size={128} />
        </div>
        <h1 className="display-3 fw-bold text-body-emphasis mb-2">{reader.name}</h1>
        <p className="fs-4 mb-1">{aboutLine(reader)}</p>
        <p className="small text-body-secondary mt-2 mb-0">
          {[
            reader.languages.length > 0 && `Talks in ${reader.languages.map((code) => languageName(code) ?? code).join(", ")}`,
            `${reader.read.length} ${reader.read.length === 1 ? "book" : "books"} read`,
            finished > 0 && `${finished} ${finished === 1 ? "track" : "tracks"} finished`,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>

        {me ? (
          <Button as={Link} to="/account" size="lg" variant="outline-primary" className="px-5 mt-4">
            Edit your profile
          </Button>
        ) : (
          <Button size="lg" className="px-5 mt-4" onClick={() => askQuestion({ reader })}>
            Ask {firstName(reader)} a question
          </Button>
        )}
        <p className="small text-body-secondary mt-2 mb-0">
          {me ? "This is how other readers see you." : "Questions and replies come in under Messages."}
        </p>

        <div className="mx-auto mt-5" style={{ maxWidth: "40rem" }}>
          {reader.bio ? (
            <p className="lead">{reader.bio}</p>
          ) : (
            <p className="lead text-body-secondary">
              {me ? (
                <>
                  No bio yet. <Link to="/account">Tell other readers about yourself</Link>.
                </>
              ) : (
                `${firstName(reader)} hasn't written a bio yet.`
              )}
            </p>
          )}
          <div className="d-flex flex-wrap justify-content-center gap-1">
            {reader.fields.map((f) => (
              <SubtleBadge key={f} tone="primary">
                {f}
              </SubtleBadge>
            ))}
          </div>
        </div>

      </header>

      {known.length > 0 && (
        <section className="mt-5">
          <SectionHeader title={me ? "Your tracks" : `Tracks ${firstName(reader)} knows`}>
            {me ? "The tracks you follow and completed, and the ones you've read the most of. Other readers can ask you about them." : "The tracks they follow and completed, and the ones with the most books read. Ask about any of them."}
          </SectionHeader>
          {/* one under the other in the page's centred column, not spread across its width */}
          <div className="mx-auto" style={{ maxWidth: "40rem" }}>
            <Loader key={reader.id} fallback={<ListPlaceholder rows={known.length} />}>
              <ul className="list-group shadow-sm">
                {known.map(({ track, kept, count }) => (
                  <li key={track.id} className="list-group-item py-3">
                    <div className="d-flex justify-content-between align-items-baseline gap-3 mb-2">
                      <Link to={`/tracks/${track.id}`} className="fw-medium link-body-emphasis text-decoration-none">
                        {track.title}
                      </Link>
                      <span className="small text-body-secondary text-nowrap">
                        {kept === "completed" ? "Completed" : [kept === "following" && "Following", count === track.books.length ? "All read" : `${count} of ${track.books.length} read`].filter(Boolean).join(" · ")}
                      </span>
                    </div>
                    <ProgressBar now={kept === "completed" ? 100 : (count / track.books.length) * 100} style={{ height: 6 }} aria-label={`${count} of ${track.books.length} books read`} />
                  </li>
                ))}
              </ul>
            </Loader>
          </div>
        </section>
      )}

      {reader.reading.length > 0 && (
        <section className="mt-5">
          <SectionHeader title="Reading now">
            {me ? "Other readers reading these too can compare notes with you." : `Reading one of these too? Ask ${name} how it's going.`}
          </SectionHeader>
          <BookRow slugs={reader.reading} />
        </section>
      )}

      {reader.read.length > 0 ? (
        <section className="mt-5">
          <SectionHeader title={me ? "Books you've read" : `Books ${firstName(reader)} has read`}>
            {me ? "Other readers can ask you about these." : "Ask about any of them."}
          </SectionHeader>
          <BookRow slugs={reader.read} />
        </section>
      ) : (
        me && (
          <p className="text-center text-body-secondary mt-5">
            Mark books as “Reading now” or “Finished” on their pages, and they show here.
          </p>
        )
      )}
    </Container>
  );
}
