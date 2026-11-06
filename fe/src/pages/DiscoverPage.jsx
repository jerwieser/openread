import { useDeferredValue, useMemo } from "react";
import { Button, Card, Col, Container, Form, Row, Spinner } from "react-bootstrap";
import { Link, useSearchParams } from "react-router-dom";

import { IconCircle } from "../components/Icon.jsx";
import { FilterBarPlaceholder, GridPlaceholder, Loader, ScrollGrid, TrackCardPlaceholder } from "../components/Loading.jsx";
import { TRACK_GRID } from "../components/grids.js";
import PageHeader, { SectionHeader } from "../components/PageHeader.jsx";
import TagSearch from "../components/TagSearch.jsx";
import TrackCard from "../components/TrackCard.jsx";
import { plain } from "../data/books.js";
import { readingTracks, toTrack, trackTags } from "../data/tracks.js";
import { useTracks, useUser } from "../store.js";

// a grid of track cards, loading on its own with card-shaped placeholders
function TrackGrid({ tracks }) {
  return (
    <Loader fallback={<GridPlaceholder Item={TrackCardPlaceholder} count={tracks.length} {...TRACK_GRID} />}>
      <Row {...TRACK_GRID}>
        {tracks.map((t) => (
          <Col key={t.id}>
            <TrackCard track={t} />
          </Col>
        ))}
      </Row>
    </Loader>
  );
}

// everything plain text can match in a track: its title, tagline, description and tags, and the titles
// and authors of its books, so "Orwell" finds the tracks his books are on
const SEARCHABLE = new Map(
  readingTracks().map((t) => [
    t.id,
    plain([t.title, t.tagline, t.description, ...t.tags, ...t.books.flatMap((s) => [s.book.title, s.book.author])].join(" ")).toLowerCase(),
  ]),
);

const matches = (track, query) => plain(query).toLowerCase().trim().split(/\s+/).every((word) => SEARCHABLE.get(track.id).includes(word));

const KNOWN = new Set(trackTags().map((t) => t.tag));

// Discover (/discover): where readers find something to read, and that is a reading track first. There
// will be many tracks, each on one specific subject, so finding one is a search by tags: pick one or
// more and only the tracks with all of them are left. Text typed without picking a tag searches the
// tracks too. Both live in the URL (?tags=cycling,doping&q=armstrong), so a search can be linked to and
// the landing page and the tags on a track's page can start one. Single books come second: one quiet
// line under the search leads to the full list (/books).
export default function DiscoverPage() {
  const [own] = useTracks();
  const user = useUser();
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const tagParam = params.get("tags") ?? "";
  const selected = useMemo(() => tagParam.split(",").filter((t) => KNOWN.has(t)), [tagParam]);
  const search = useDeferredValue(query);
  const mine = user ? own.map(toTrack) : [];
  const filtered = Boolean(query.trim() || selected.length);

  const set = (key, value) =>
    setParams((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
      return p;
    }, { replace: true });

  // the tracks with every chosen tag, and of those the ones that match the typed text
  const tagged = useMemo(() => readingTracks().filter((t) => selected.every((tag) => t.tags.includes(tag))), [selected]);
  const ours = useMemo(() => (search.trim() ? tagged.filter((t) => matches(t, search)) : tagged), [tagged, search]);
  // the tags to suggest next, counted among the tracks left, so every suggestion still finds something
  const suggestions = useMemo(() => {
    if (!selected.length) return trackTags();
    const count = {};
    for (const t of tagged) for (const tag of t.tags) count[tag] = (count[tag] ?? 0) + 1;
    return trackTags().filter(({ tag }) => count[tag]).map(({ tag }) => ({ tag, count: count[tag] })).sort((a, b) => b.count - a.count);
  }, [selected, tagged]);

  return (
    <Container className="py-5">
      <PageHeader
        title="Discover"
        actions={
          <Button as={Link} to="/tracks/new" size="lg" className="px-4">
            Create a track
          </Button>
        }
      >
        Want to know more about something? Find a reading track for it: a handful of books, in order, that take you into
        one subject, from the French Revolution to the Dutch Golden Age. Pick the tags you&apos;re curious about.
      </PageHeader>

      <Loader fallback={<FilterBarPlaceholder fields={[12]} buttons={false} />}>
        <Card body className="mb-4 shadow-sm">
          <Form.Label htmlFor="track-tags">What do you want to know more about?</Form.Label>
          <TagSearch
            id="track-tags"
            tags={suggestions}
            selected={selected}
            onChange={(tags, text) =>
              setParams((p) => {
                for (const [key, value] of [["tags", tags.join(",")], ["q", text]]) value ? p.set(key, value) : p.delete(key);
                return p;
              }, { replace: true })
            }
            text={query}
            onText={(text) => set("q", text)}
            placeholder="Search tags: cycling, france, art…"
          />
        </Card>
        <p className="small text-body-secondary text-center mb-4">
          Looking for one book instead? <Link to="/books">Browse the books</Link>
        </p>
        {/* how many there are, centred over the grid like the line above */}
        <p className="small text-body-secondary d-flex justify-content-center align-items-center gap-2 mb-4" aria-live="polite">
          {filtered ? `${ours.length} of ${readingTracks().length} tracks` : `${readingTracks().length} tracks`}
          {query !== search && (
            <Spinner animation="border" size="sm" role="status">
              <span className="visually-hidden">Searching…</span>
            </Spinner>
          )}
          {filtered && (
            <>
              <span aria-hidden="true">·</span>
              <Button variant="link" size="sm" className="p-0 text-decoration-none" onClick={() => setParams({}, { replace: true })}>
                Clear filters
              </Button>
            </>
          )}
        </p>
      </Loader>

      {mine.length > 0 && !filtered && (
        <section className="mb-5">
          <SectionHeader title="Your tracks">Only you see these here; share one with its link.</SectionHeader>
          <TrackGrid tracks={mine} />
        </section>
      )}

      <section>
        {mine.length > 0 && !filtered && <SectionHeader title="Our tracks" />}
        {ours.length > 0 ? (
          <Loader fallback={<GridPlaceholder Item={TrackCardPlaceholder} count={Math.min(ours.length, 6)} {...TRACK_GRID} />}>
            {/* twelve at a time, more as the reader scrolls; a new search starts again from the top */}
            <ScrollGrid
              key={`${search}|${tagParam}`}
              items={ours}
              batch={12}
              label="tracks"
              render={(t) => <TrackCard track={t} />}
              {...TRACK_GRID}
            />
          </Loader>
        ) : (
          <div className="text-center py-5">
            <IconCircle name="search" size={72} tone="secondary" />
            <p className="lead mt-3">No track about that yet.</p>
            <div className="d-flex flex-wrap justify-content-center gap-2">
              {query.trim() && (
                <Button as={Link} to={`/tracks/new?title=${encodeURIComponent(query.trim())}`}>
                  Make a track about “{query.trim()}”
                </Button>
              )}
              <Button variant="outline-primary" onClick={() => setParams({}, { replace: true })}>
                Show all tracks
              </Button>
            </div>
          </div>
        )}
      </section>
    </Container>
  );
}
