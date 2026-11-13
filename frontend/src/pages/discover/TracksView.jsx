// Discover's Tracks view: every reading track, narrowed by tags (all of the picked ones) and by
// what's typed. The tags to pick next are the ones the tracks left still have, with how many, so
// every chip finds something. A search that finds nothing offers the topics spelt like it, and making
// a track about it.
import { useMemo, useState } from "react";
import { Button } from "react-bootstrap";
import { Link } from "react-router-dom";

import { IconCircle } from "../../components/Icon.jsx";
import { GridPlaceholder, Loader, ScrollGrid, TrackCardPlaceholder } from "../../components/Loading.jsx";
import TrackCard from "../../components/TrackCard.jsx";
import { readingTracks, toTrack } from "../../data/tracks.js";
import { useTracks, useUser } from "../../store.js";
import { closeTopics, findTracks, nextTags } from "./discover.js";
import { SectionTitle, TopicChip, TrackRow, TRACKS } from "./parts.jsx";

const FIRST_TAGS = 14; // tags shown before "More topics"

export default function TracksView({ params, set, clear, onTopic }) {
  const user = useUser();
  const [own] = useTracks();
  const query = (params.get("q") ?? "").trim();
  const tagParam = params.get("tags") ?? "";
  const known = useMemo(() => new Set(readingTracks().flatMap((t) => t.tags)), []);
  const selected = useMemo(() => tagParam.split(",").filter((t) => known.has(t)), [tagParam, known]);
  const [allTags, setAllTags] = useState(false);

  const tracks = useMemo(() => findTracks(query, selected), [query, selected]);
  // the tags to add, among the tracks the tags picked so far leave (not the typed text: a tag is
  // another way in, not a narrowing of the words)
  const offered = useMemo(() => nextTags(findTracks("", selected), selected), [selected]);
  const shownTags = allTags ? offered : offered.slice(0, FIRST_TAGS);
  const mine = user && !query && !selected.length ? own.map(toTrack) : [];
  const filtered = Boolean(query || selected.length);
  const setTags = (tags) => set({ tags: tags.join(",") });

  return (
    <>
      <div className="discover-filters bg-body rounded-4 shadow-sm p-3 mb-4">
        <div className="d-flex flex-wrap align-items-center gap-2">
          <span className="small fw-semibold text-body-secondary me-1">{selected.length ? "Tracks about" : "Pick a topic"}</span>
          {selected.map((tag) => (
            <TopicChip key={tag} topic={{ kind: "tag", id: tag, label: tag }} picked onClick={() => setTags(selected.filter((t) => t !== tag))} />
          ))}
          {selected.length > 0 && offered.length > 0 && <span className="small text-body-secondary mx-1">and</span>}
          {shownTags.map((topic) => (
            <TopicChip key={topic.id} topic={topic} onClick={() => setTags([...selected, topic.id])} />
          ))}
          {offered.length > FIRST_TAGS && (
            <Button variant="link" size="sm" className="text-decoration-none" onClick={() => setAllTags(!allTags)}>
              {allTags ? "Fewer topics" : `${offered.length - FIRST_TAGS} more topics`}
            </Button>
          )}
        </div>
      </div>

      <p className="small text-body-secondary d-flex justify-content-center align-items-center gap-2 mb-4" aria-live="polite">
        {filtered ? `${tracks.length} of ${readingTracks().length} tracks` : `${readingTracks().length} tracks`}
        {filtered && (
          <>
            <span aria-hidden="true">·</span>
            <Button variant="link" size="sm" className="p-0 text-decoration-none" onClick={clear}>
              Clear all
            </Button>
          </>
        )}
      </p>

      {mine.length > 0 && (
        <section className="mb-5">
          <SectionTitle icon="signpost-split" tone="success" title="Your tracks" count={mine.length}>
            Only you see these here; share one with its link.
          </SectionTitle>
          <TrackRow tracks={mine} />
        </section>
      )}

      {tracks.length > 0 ? (
        <section>
          {mine.length > 0 && <SectionTitle icon="compass" title="Our tracks" count={tracks.length} />}
          <Loader fallback={<GridPlaceholder Item={TrackCardPlaceholder} count={Math.min(tracks.length, 6)} {...TRACKS} />}>
            {/* twelve at a time, more as the reader scrolls; a new search starts again from the top */}
            <ScrollGrid key={`${query}|${tagParam}`} items={tracks} batch={12} label="tracks" render={(t) => <TrackCard track={t} />} {...TRACKS} />
          </Loader>
        </section>
      ) : (
        <NoTracks query={query} onTopic={onTopic} clear={clear} />
      )}
    </>
  );
}

// No track for the search: the topics nearest to it, the most followed tracks, and making one
function NoTracks({ query, onTopic, clear }) {
  const near = closeTopics(query);
  return (
    <div className="text-center py-4">
      <IconCircle name="signpost-split" size={72} tone="secondary" />
      <p className="lead mt-3 mb-1">No track about {query ? <>“{query}”</> : "all of those"} yet.</p>
      {near.length > 0 && (
        <>
          <p className="text-body-secondary mb-2">Maybe one of these?</p>
          <div className="d-flex flex-wrap justify-content-center gap-2 mb-3">
            {near.map((topic) => (
              <TopicChip key={`${topic.kind}-${topic.id}`} topic={topic} onClick={() => onTopic(topic)} />
            ))}
          </div>
        </>
      )}
      <div className="d-flex flex-wrap justify-content-center gap-2 mt-3">
        <Button as={Link} to={`/tracks/new${query ? `?title=${encodeURIComponent(query)}` : ""}`}>
          {query ? <>Make a track about “{query}”</> : "Make a track"}
        </Button>
        <Button variant="outline-primary" onClick={clear}>
          Show all tracks
        </Button>
      </div>
      <div className="mt-5 text-start">
        <SectionTitle icon="star" tone="warning" title="Start with one of these" />
        <TrackRow tracks={readingTracks().slice(0, 3)} />
      </div>
    </div>
  );
}
