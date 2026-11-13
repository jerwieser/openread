// Everything the site shows, from the API. The catalogue everyone sees (our tracks, the readers and
// their published reflections, and of the books ours and the ones those refer to) is loaded once when
// the site opens; the other books, too many to hold, as the reader gets to them (holdBooks); so is the
// logged-in reader's own: their account, where they are with each book and track, own tracks, reflections (drafts too),
// book suggestions and messages. Pages read it with the hooks below, which keep them up to date;
// writes go to the API and then update the store, so every page showing the same thing changes at
// once.
import { useCallback, useSyncExternalStore } from "react";

import { api, setUnauthorizedHandler } from "./api.js";
import { READER_LANGUAGES, setReadingLanguages } from "./data/languages.js";

// the books' titles in the reader's languages come with them (theirs once they're logged in)
const languages = () => `languages=${encodeURIComponent(READER_LANGUAGES.join(","))}`;

// the reader's own things while nobody is logged in
const NONE = { user: null, statuses: {}, follows: {}, ownTracks: [], ownReflections: [], suggestions: [], inbox: [] };

// catalogue: "loading" while the site opens (load), then "loaded", or "unreachable" when the API
// didn't answer
const state = { catalogue: "loading", books: [], tracks: [], readers: [], reflections: [], ...NONE };
const listeners = new Set();

function set(changes) {
  Object.assign(state, changes);
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// one part of the store, as it is now: read("books")
export const read = (key) => state[key];

// any value read from the store, kept up to date: useStore(() => …)
export const useStore = (get) => useSyncExternalStore(subscribe, get);

// A write the page doesn't wait for (putting a book on the bookshelf, marking it finished) shows what it will be straight
// away; when the API refuses, it goes back and the message area says why (see Messages.jsx)
let reportError = (error) => console.error(error);
export const onBackgroundError = (report) => {
  reportError = report;
};

async function optimistic(key, value, save) {
  const before = state[key];
  set({ [key]: value });
  try {
    await save();
  } catch (error) {
    set({ [key]: before });
    reportError(error);
  }
}

// --- the API's words and the site's
//
// What readers call a book the API calls a work, after the library standard (see api/models/__init__.py):
// Bonita Avenue in any language and print, as opposed to one of its editions. The site says "book"
// throughout, so the few fields that differ are renamed here, on the way in and on the way out, and
// nothing past the store knows.

const fromApi = {
  track: ({ works, ...track }) => ({ ...track, books: works }),
  reflection: ({ workSlug, ...reflection }) => ({ ...reflection, bookSlug: workSlug }),
  suggestion: ({ work, ...suggestion }) => ({ ...suggestion, book: work }),
};
const each = (convert) => (list) => list.map(convert);
const toApiReflection = ({ bookSlug, ...reflection }) => ({ ...reflection, workSlug: bookSlug });

// --- the catalogue

const CATALOGUE = {
  // ours (curated); the others the site holds come along, so a change of languages renames them too
  books: async () => {
    const [curated, others] = await Promise.all([
      api.get(`/works?curated=true&${languages()}`),
      fetchBooks(state.books.filter((b) => !b.curated).map((b) => b.slug)),
    ]);
    return [...curated, ...others];
  },
  tracks: () => api.get(`/tracks?${languages()}`).then(each(fromApi.track)),
  readers: () => api.get("/readers"),
  reflections: () => api.get("/reflections").then(each(fromApi.reflection)),
};

async function reload(...keys) {
  const values = await Promise.all(keys.map((key) => CATALOGUE[key]()));
  set(Object.fromEntries(keys.map((key, i) => [key, values[i]])));
}

// --- the books the site holds: ours, the ones the rest of the catalogue and the reader's own things
// refer to, and the ones the reader has come across (searched, browsed, opened). The others are asked
// for as the reader gets to them.

const BATCH = 200;

// the API's books with these slugs, 200 a request
async function fetchBooks(slugs) {
  const batches = [];
  for (let i = 0; i < slugs.length; i += BATCH) batches.push(slugs.slice(i, i + BATCH));
  const found = await Promise.all(batches.map((batch) => api.get(`/works?slugs=${batch.map(encodeURIComponent).join(",")}&${languages()}`)));
  return found.flat();
}

// these books from the API into the ones the site holds, in place of the ones it has
function addBooks(found) {
  if (!found.length) return;
  const fresh = new Map(found.map((b) => [b.slug, b]));
  set({ books: [...state.books.filter((b) => !fresh.has(b.slug)), ...fresh.values()] });
}

// The books with these slugs, which the site holds from then on: the ones it doesn't yet, asked for
// once each (an unknown slug isn't asked for again, unless the API didn't answer). Resolves once
// they're in, also when another page asked for them first.
const asked = new Map(); // slug: the request that brings it
export function holdBooks(slugs) {
  const wanted = [...new Set(slugs)].filter(Boolean);
  const held = new Set(state.books.map((b) => b.slug));
  const missing = wanted.filter((s) => !held.has(s) && !asked.has(s));
  if (missing.length) {
    const request = fetchBooks(missing).then(addBooks, (error) => {
      missing.forEach((s) => asked.delete(s));
      throw error;
    });
    missing.forEach((s) => asked.set(s, request));
  }
  return Promise.all(wanted.filter((s) => asked.has(s)).map((s) => asked.get(s)));
}

// the books the catalogue and the reader's own things refer to: our tracks' stops, what the readers
// have read and are reading, the reflections' books, and the reader's bookshelf, tracks and suggestions
const referred = () => [
  ...state.tracks.flatMap((t) => t.books.map((s) => s.slug)),
  ...state.readers.flatMap((r) => [...r.read, ...r.reading]),
  ...state.reflections.map((r) => r.bookSlug),
  ...Object.keys(state.statuses),
  ...state.ownTracks.flatMap((t) => t.slugs),
  ...state.ownReflections.map((r) => r.bookSlug),
  ...state.suggestions.map((s) => s.book),
];

// the filters of a list of all the books as the API's query: the ones set
const browsing = (params) => new URLSearchParams(Object.entries(params).filter(([, v]) => v !== "" && v != null && v !== false));

// A page of all the books (GET /works: filters, sort, offset, limit), which the site holds from then
// on. Gives their slugs, in order.
export async function browseBooks(params) {
  const found = await api.get(`/works?${browsing(params)}&${languages()}`);
  addBooks(found);
  return found.map((b) => b.slug);
}

// How many books all the books are with these filters (GET /works/count), however many pages
export async function countBooks(params) {
  return (await api.get(`/works/count?${browsing(params)}`)).count;
}

// The books from another site's export that are on OpenRead (POST /works/match): each one's slug or
// null, in their order. The site holds them from then on.
export async function matchBooks(rows) {
  const { slugs, works } = await api.post(`/works/match?${languages()}`, rows.map(({ title, author, isbn }) => ({ title, author: author ?? "", isbn: isbn || null })));
  addBooks(works);
  return slugs;
}

// When the site opens, while the menu and footer already show: the catalogue, and the reader's own
// things if they're logged in. The pages show once it's loaded (App.jsx, Opened).
export async function load() {
  try {
    const [me] = await Promise.all([api.get("/auth/me").catch(() => null), reload(...Object.keys(CATALOGUE))]);
    if (me) await signIn(me);
    await holdBooks(referred());
    set({ catalogue: "loaded" });
  } catch (error) {
    console.error(error);
    set({ catalogue: "unreachable" });
  }
}

export const useCatalogue = () => useStore(() => state.catalogue);

export const useReaders = () => useStore(() => state.readers);

// One of Open Library's works as a book on OpenRead (the API adds it the first time a reader picks
// it), straight into the catalogue the site holds. Gives the book.
export async function addFromOpenLibrary(work) {
  const book = await api.post(`/works/openlibrary/${work}?${languages()}`);
  addBooks([book]);
  return book;
}
export const usePublished = () => useStore(() => state.reflections);

// The books a search finds (GET /works?q=, see api/services/search.py), the best match first, by slug: by their
// titles in every language and their authors' names in every spelling, of which the books the site
// holds carry only the reader's. Any it doesn't hold yet join them.
export async function searchBooks(query, limit = 100) {
  const found = await api.get(`/works?q=${encodeURIComponent(query)}&limit=${limit}&${languages()}`);
  const held = new Set(state.books.map((b) => b.slug));
  const added = found.filter((b) => !held.has(b.slug));
  if (added.length) set({ books: [...state.books, ...added] });
  return found.map((b) => b.slug);
}

// --- the logged-in reader

// The account, or null: { id (their handle), name, email, verified, role } and the profile other
// readers see: { tagline, location, bio, languages, fields, photo }
export const useUser = () => useStore(() => state.user);

// the admins review the books readers suggest
export const isAdmin = (user) => user?.role === "admin";

const toUser = (me) => ({ ...me, verified: me.emailVerified });

let polling;

async function signIn(me) {
  const user = toUser(me);
  set({ user });
  await applyReadingLanguages();
  // the rest waits until they've confirmed their email address
  if (!user.verified) return state.user;
  const [statuses, follows, ownTracks, ownReflections, suggestions, inbox] = await Promise.all([
    api.get("/me/statuses"),
    api.get("/me/follows"),
    api.get("/me/tracks"),
    api.get("/me/reflections").then(each(fromApi.reflection)),
    api.get(isAdmin(user) ? "/suggestions" : "/me/suggestions").then(each(fromApi.suggestion)),
    api.get("/me/messages"),
  ]);
  set({ statuses, follows: byTrack(follows), ownTracks, ownReflections, suggestions, inbox });
  // the books on their bookshelf and tracks that the site doesn't hold yet
  await holdBooks(referred());
  // new messages from other readers come in while the site is open
  clearInterval(polling);
  polling = setInterval(() => document.visibilityState === "visible" && refreshInbox(), 30000);
  return state.user;
}

function signOut() {
  clearInterval(polling);
  set(NONE);
  applyReadingLanguages();
}

// The books and tracks again, in the logged-in reader's reading languages (or the browser's), when
// those aren't the ones they came in
async function applyReadingLanguages() {
  if (setReadingLanguages(state.user?.readingLanguages)) await reload("books", "tracks");
}

// the session ran out: the site carries on logged out
setUnauthorizedHandler(() => state.user && signOut());

export async function logIn(email, password) {
  await api.login(email, password);
  return signIn(await api.get("/auth/me"));
}

// a new account starts with a name from the email address, which the next step asks them to change
export async function signUp(email, password) {
  return signIn(await api.post("/auth/register", { email, password }));
}

export async function logOut() {
  await api.post("/auth/logout");
  signOut();
}

export async function updateAccount(changes) {
  set({ user: toUser(await api.patch("/me", changes)) });
  await Promise.all([reload("readers", "reflections"), applyReadingLanguages()]); // their name and photo show on these
  return state.user;
}

export async function deleteAccount() {
  await api.delete("/me");
  signOut();
  await reload("readers", "reflections");
}

export const changeEmail = (email) => api.post("/auth/change-email", { email });

export const resendVerification = () => api.post("/auth/resend-verification");

export const forgotPassword = (email) => api.post("/auth/forgot-password", { email });

// the links in the emails: each logs the reader in, and confirms their address, which puts them
// among the readers
async function signInFromEmail(me) {
  await reload("readers");
  return signIn(me);
}
export const verifyEmail = async (token) => signInFromEmail(await api.post("/auth/verify-email", { token }));
export const resetPassword = async (token, password) => signInFromEmail(await api.post("/auth/reset-password", { token, password }));

// --- where the reader is with each book, by slug, most recently changed first: "want", "reading",
// "paused", "finished" or "stopped" (see components/BookStatus.jsx). Reading and finished put them
// among the readers on the book's page and on their profile.

// the statuses that show the reader to others, so changing one reloads the readers
const PUBLIC = ["reading", "finished"];

export function useStatuses() {
  const statuses = useStore(() => state.statuses);
  const setStatus = useCallback(async (slug, status) => {
    const { [slug]: before, ...rest } = state.statuses;
    // No status (null or "") takes the book off the bookshelf; a new one puts it first. Finishing a
    // book can move the tracks the reader follows along: the API puts the next book on Want to read
    // and completes a track whose stops are all done, so the statuses come back whole.
    await optimistic("statuses", status ? { [slug]: status, ...rest } : rest, async () =>
      set({ statuses: await api.put(`/me/statuses/${slug}`, { status: status || null }) }),
    );
    if (status === "finished") set({ follows: byTrack(await api.get("/me/follows")) });
    if (PUBLIC.includes(before) || PUBLIC.includes(status)) await reload("readers");
  }, []);
  return [statuses, setStatus];
}

// Many statuses at once, from an import (see data/imports.js): [{ slug, status }]. Books the reader
// already has a status for keep theirs unless replace is true. Finished books can move the tracks
// they follow along, and reading or finished ones show them to others, so those come back too.
export async function importStatuses(books, replace) {
  set({ statuses: await api.post("/me/statuses/import", { works: books, replace }) });
  set({ follows: byTrack(await api.get("/me/follows")) });
  await reload("readers");
}

// --- the tracks the reader keeps, ours and their own, by id, most recently changed first:
// { state: "saved" | "following" | "paused" | "completed", startedAt, pausedAt, completedAt, skips }
// where skips are the slugs of the books they skipped on it. How far they are follows from their
// books' statuses (see trackProgress in data/tracks.js).

const byTrack = (follows) => Object.fromEntries(follows.map(({ track, ...follow }) => [track, follow]));

// a change to a track can change Want to read (its next book goes on, a skipped one comes off), and
// following or completing one of ours shows on the reader's profile. True once it's done; when the
// API refuses, the message area says why.
async function changeTrack(id, write) {
  const before = state.follows[id]?.state;
  try {
    const follows = await write();
    set({ follows: byTrack(follows), statuses: await api.get("/me/statuses") });
  } catch (error) {
    reportError(error);
    return false;
  }
  const shown = (s) => s && s !== "saved";
  if (shown(before) || shown(state.follows[id]?.state)) await reload("readers");
  return true;
}

export function useFollows() {
  const follows = useStore(() => state.follows);
  // "saved", "following", "paused" or "completed", or null to leave the track
  const setFollow = useCallback((id, followState) => changeTrack(id, () => api.put(`/me/follows/${id}`, { state: followState })), []);
  const setSkip = useCallback(
    (id, slug, skipped) => changeTrack(id, () => (skipped ? api.put(`/me/follows/${id}/skips/${slug}`, {}) : api.delete(`/me/follows/${id}/skips/${slug}`))),
    [],
  );
  return [follows, setFollow, setSkip];
}

// --- the reader's own reading tracks: { id, title, description, slugs, image } in reading order

async function addTrack(track) {
  const saved = await api.post("/tracks", track);
  set({ ownTracks: [saved, ...state.ownTracks] });
  return saved;
}

async function updateTrack(id, track) {
  const saved = await api.put(`/tracks/${id}`, track);
  set({ ownTracks: state.ownTracks.map((t) => (t.id === id ? saved : t)) });
  return saved;
}

async function removeTrack(id) {
  await api.delete(`/tracks/${id}`);
  set({ ownTracks: state.ownTracks.filter((t) => t.id !== id) });
}

export const useTracks = () => [useStore(() => state.ownTracks), addTrack, removeTrack, updateTrack];

// --- the reader's own reflections, drafts included: { id, bookSlug, title, text, status, date }

async function addReflection(reflection) {
  const saved = fromApi.reflection(await api.post("/reflections", toApiReflection(reflection)));
  set({ ownReflections: [saved, ...state.ownReflections] });
  await reload("reflections");
  return saved;
}

async function updateReflection(id, reflection) {
  const saved = fromApi.reflection(await api.put(`/reflections/${id}`, toApiReflection(reflection)));
  set({ ownReflections: state.ownReflections.map((r) => (r.id === id ? saved : r)) });
  await reload("reflections");
  return saved;
}

async function removeReflection(id) {
  await api.delete(`/reflections/${id}`);
  set({ ownReflections: state.ownReflections.filter((r) => r.id !== id) });
  await reload("reflections");
}

export const useReflections = () => [useStore(() => state.ownReflections), addReflection, removeReflection, updateReflection];

// --- books readers suggested: { id, title, author, year, url, cover, note, difficulty, name, email,
// status, reason, book }, where status is "pending" until an admin approves or rejects it, and book is
// the slug of the book it became. Readers see their own; admins see everyone's.

async function addSuggestion(suggestion) {
  const saved = fromApi.suggestion(await api.post("/suggestions", suggestion));
  set({ suggestions: [saved, ...state.suggestions] });
  return saved;
}

// an admin's decision: { status, reason, difficulty }; approving adds the book to the catalogue and
// sending it back to waiting takes it off again
async function decideSuggestion(id, decision) {
  const saved = fromApi.suggestion(await api.patch(`/suggestions/${id}`, decision));
  set({ suggestions: state.suggestions.map((s) => (s.id === id ? saved : s)) });
  await reload("books");
  return saved;
}

export const useSuggestions = () => [useStore(() => state.suggestions), addSuggestion, undefined, decideSuggestion];

// --- messages between readers, by reader id: { id, from, to, text, createdAt, readAt (null while
// unread) }. See data/inbox.js.

export const useInbox = () => useStore(() => state.inbox);

export async function refreshInbox() {
  if (state.user) set({ inbox: await api.get("/me/messages") });
}

export async function postMessage(to, text) {
  const saved = await api.post("/messages", { to, text });
  set({ inbox: [saved, ...state.inbox] });
  return saved;
}

// everything the other reader sent the reader, marked as read
export function markRead(otherId) {
  const now = new Date().toISOString();
  const unread = (m) => m.from === otherId && m.to === state.user?.id && !m.readAt;
  if (!state.inbox.some(unread)) return;
  optimistic("inbox", state.inbox.map((m) => (unread(m) ? { ...m, readAt: now } : m)), () => api.post("/me/messages/read", { other: otherId }));
}
