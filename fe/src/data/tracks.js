// Reading tracks: a series of books to read in order, each about one specific subject: the French
// Revolution, the Tour de France, modern art. A few are broader, like the classics of one country.
// Following a track takes the reader through its books one at a time. Ours come from the API, in our
// order, each with three to ten tags, lower case, some shared by many tracks ("history", "novels")
// and some specific ("cycling").
import { read } from "../store.js";
import { bookBySlug } from "./books.js";

// each stop on a track: the book, plus the canon window and note where the track has them. Each of
// ours has a scene drawn for it behind the covers on its card (media/track_covers/<id>.svg). Retired ones
// are only for the readers who keep them: their pages, bookshelves and profiles still find them by
// id, but Discover, the tags and the book pages list the others (readingTracks).
//
// Built from the store when first asked, not when this file is first run: the home page shows before
// the catalogue is in (empty lists till then). Built again when the tracks or the books change, as
// when a reader's languages bring them in other titles.
let built = { tracks: null, books: null, all: [], reading: [], tags: [] };

function current() {
  const tracks = read("tracks");
  const books = read("books");
  if (built.tracks === tracks && built.books === books) return built;
  const all = tracks.map((track) => ({
    ...track,
    books: track.books.map(({ slug, window, note }) => ({ book: bookBySlug(slug), window, note })).filter((stop) => stop.book),
  }));
  const reading = all.filter((t) => !t.retired);
  // every tag with the number of tracks that have it, the most used first
  const tags = Object.entries(reading.flatMap((t) => t.tags).reduce((count, tag) => ({ ...count, [tag]: (count[tag] ?? 0) + 1 }), {}))
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));
  built = { tracks, books, all, reading, tags };
  return built;
}

export const readingTracks = () => current().reading;

export const trackTags = () => current().tags;

export const trackById = (id) => current().all.find((t) => t.id === id);

export const tracksFor = (book) => readingTracks().filter((t) => t.books.some((s) => s.book.slug === book.slug));

// How far the reader is on a track, from their books' statuses and the books they skipped on it (a
// follow from the store). A stop is done when its book is finished, wherever they read it, or skipped
// here; the first stop that isn't done is up next. A book finished after the one up next was read
// ahead. Each stop: { book, number, status, skipped, done, upNext, ahead }.
export function trackProgress(track, statuses, follow) {
  const skips = follow?.skips ?? [];
  const stops = track.books.map(({ book }, i) => {
    const status = statuses[book.slug] ?? null;
    const skipped = skips.includes(book.slug) && status !== "finished";
    return { book, number: i + 1, status, skipped, done: skipped || status === "finished" };
  });
  const next = stops.find((s) => !s.done) ?? null;
  for (const stop of stops) {
    stop.upNext = stop === next;
    stop.ahead = Boolean(next) && !stop.skipped && stop.done && stop.number > next.number;
  }
  const finished = stops.filter((s) => s.status === "finished").length;
  const skipped = stops.filter((s) => s.skipped).length;
  return { stops, next, finished, skipped, done: finished + skipped, total: stops.length };
}

// the states a reader is on a track in, as words
export const FOLLOW_LABEL = { saved: "Saved for later", following: "Following", paused: "Paused", completed: "Completed" };

// A track the reader made, in the same shape as ours; image is the picture they uploaded, if any
export function toTrack({ id, title, description, slugs, image }) {
  return { id, title, description, image, books: slugs.map(bookBySlug).filter(Boolean).map((book) => ({ book })), own: true };
}

// A shared track travels inside its link (/tracks/shared?t=…): the title, description and book slugs
// as base64url JSON. It opens in any browser, with no account or server, and carries nothing about
// who made it.
export function encodeTrack({ title, description, books }) {
  const json = JSON.stringify({ t: title, d: description || undefined, b: books.map((s) => s.book.slug) });
  const bytes = new TextEncoder().encode(json);
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// what a shared link holds ({ t, d, b }), or null when it's damaged
function parseShared(code) {
  try {
    const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(binary, (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

// the slugs of a shared track's books, for the site to hold before it shows the track (useHeld)
export function sharedSlugs(code) {
  const b = parseShared(code)?.b;
  return Array.isArray(b) ? b.filter((s) => typeof s === "string") : [];
}

// the track in a shared link, or null when the link is damaged or names no books we have (the site
// holds them: sharedSlugs)
export function decodeTrack(code) {
  try {
    const { t, d, b } = parseShared(code) ?? {};
    const books = (Array.isArray(b) ? b : []).map(bookBySlug).filter(Boolean);
    if (typeof t !== "string" || !t.trim() || books.length === 0) return null;
    return {
      id: "shared",
      title: t.trim().slice(0, 120),
      description: typeof d === "string" ? d.slice(0, 600) : "",
      books: books.map((book) => ({ book })),
      shared: true,
    };
  } catch {
    return null;
  }
}

// The tracks the reader keeps, ours and their own, each with its follow, most recently changed first
export function keptTracks(follows, own) {
  return Object.entries(follows)
    .map(([id, follow]) => {
      const mine = own.find((t) => t.id === id);
      return { track: trackById(id) ?? (mine && toTrack(mine)), follow };
    })
    .filter(({ track }) => track);
}
