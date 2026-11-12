// What the Discover page works out from the catalogue the site holds, outside its components: finding
// tracks by what's typed, the topics (our tracks' tags and the books' categories) that come close to
// it, even misspelt, and the tracks to suggest from what a reader has on their bookshelf.
import { plain } from "../../data/books.js";
import { CATEGORIES } from "../../data/catalogue.js";
import { readingTracks, trackTags } from "../../data/tracks.js";

export const normal = (text) => plain(text ?? "").toLowerCase().trim();

// --- tracks by text

// everything plain text can match in a track: its title, tagline, description and tags, and the titles
// and authors of its books, so "Orwell" finds the tracks his books are on. Built again when the
// tracks are (readingTracks gives a new list then).
let indexed = { tracks: null, text: new Map() };
function haystack(track) {
  const tracks = readingTracks();
  if (indexed.tracks !== tracks) indexed = { tracks, text: new Map() };
  if (!indexed.text.has(track.id)) {
    const words = [track.title, track.tagline, track.description, ...(track.tags ?? []), ...track.books.flatMap((s) => [s.book.title, s.book.author])];
    indexed.text.set(track.id, normal(words.filter(Boolean).join(" ")));
  }
  return indexed.text.get(track.id);
}

// the tracks with every one of these tags and every word typed
export function findTracks(query, tags = []) {
  const words = normal(query).split(/\s+/).filter(Boolean);
  return readingTracks().filter((t) => tags.every((tag) => t.tags.includes(tag)) && words.every((w) => haystack(t).includes(w)));
}

// --- topics

// Our topics: the tracks' tags (with how many tracks have each) and the books' categories. Each has a
// colour of Bootstrap's, the same every time, so the chips make a lively row without meaning
// anything by it.
const TONES = ["primary", "success", "danger", "warning", "info", "secondary"];
export function toneOf(id) {
  let hash = 0;
  for (const ch of id) hash = (hash * 31 + ch.charCodeAt(0)) >>> 0;
  return TONES[hash % TONES.length];
}

export const categoryTopics = () => CATEGORIES.map((c) => ({ kind: "category", id: c.id, label: c.label }));
export const tagTopics = () => trackTags().map(({ tag, count }) => ({ kind: "tag", id: tag, label: tag, count }));

// Both kinds in one list, without a tag that's also a category ("classics"): the category, which
// leads to more books. For rows of chips that mix them.
export function allTopics(tags = tagTopics(), categories = categoryTopics()) {
  const ids = new Set(categories.map((c) => c.id));
  return [...tags.filter((t) => !ids.has(t.id)), ...categories];
}

// a text's trigrams, the way pg_trgm (and the API's search) makes them: "  cy", " cyc", "cyc", …
function trigrams(text) {
  const found = new Set();
  for (const word of normal(text).split(/[^a-z0-9]+/).filter(Boolean)) {
    const padded = `  ${word} `;
    for (let i = 0; i < padded.length - 2; i++) found.add(padded.slice(i, i + 3));
  }
  return found;
}

// how alike two texts are, from 0 to 1, like pg_trgm's similarity(): "cyclng" and "cycling" 0.5
export function similarity(a, b) {
  const x = trigrams(a);
  const y = trigrams(b);
  let both = 0;
  for (const t of x) if (y.has(t)) both += 1;
  const all = x.size + y.size - both;
  return all ? both / all : 0;
}

// The topics closest to what's typed, the best first: the ones that start with it, then the ones
// that hold it, then the ones spelt nearly like it ("cyclng", "filosophy"), so a search that finds
// little still has somewhere to go
export function closeTopics(query, limit = 6) {
  const q = normal(query);
  if (q.length < 2) return [];
  return allTopics()
    .map((topic) => {
      const label = normal(topic.label);
      const score = label.startsWith(q) ? 2 : label.includes(q) || q.includes(label) ? 1.5 : Math.max(similarity(q, label), ...q.split(/\s+/).map((w) => similarity(w, label)));
      return { topic, score };
    })
    .filter(({ score }) => score >= 0.3)
    .sort((a, b) => b.score - a.score || (b.topic.count ?? 0) - (a.topic.count ?? 0))
    .slice(0, limit)
    .map(({ topic }) => topic);
}

// The tags to offer next among the tracks left, with how many of those have each, so every one still
// finds something; all of them, the most used first, before any is picked
export function nextTags(tracks, selected) {
  if (!selected.length) return tagTopics();
  const count = {};
  for (const t of tracks) for (const tag of t.tags) if (!selected.includes(tag)) count[tag] = (count[tag] ?? 0) + 1;
  return Object.entries(count)
    .map(([tag, n]) => ({ kind: "tag", id: tag, label: tag, count: n }))
    .sort((a, b) => b.count - a.count || a.id.localeCompare(b.id));
}

// --- suggestions

// The tracks with any of these books on them, besides the ones already shown: where a search's books
// lead on to. Each with the first of the books that put it here.
export function tracksWithBooks(books, shown = [], limit = 3) {
  const skip = new Set(shown.map((t) => t.id));
  const slugs = new Map(books.map((b) => [b.slug, b]));
  const found = [];
  for (const track of readingTracks()) {
    if (skip.has(track.id)) continue;
    const stop = track.books.find((s) => slugs.has(s.book.slug));
    if (stop) found.push({ track, because: stop.book });
    if (found.length >= limit) break;
  }
  return found;
}

// The tracks a reader may like, from their bookshelf: ours with books they have on it, that they don't
// keep yet, the most books in common first, each with the book they have that's on it (the most
// recently shelved: statuses come most recent first)
export function tracksForShelf(statuses, follows, limit = 3) {
  const shelved = Object.keys(statuses);
  if (!shelved.length) return [];
  const order = new Map(shelved.map((slug, i) => [slug, i]));
  return readingTracks()
    .filter((t) => !follows[t.id])
    .map((track) => {
      const mine = track.books.filter((s) => order.has(s.book.slug)).sort((a, b) => order.get(a.book.slug) - order.get(b.book.slug));
      return { track, because: mine[0]?.book, common: mine.length };
    })
    .filter(({ common }) => common > 0)
    .sort((a, b) => b.common - a.common)
    .slice(0, limit);
}
