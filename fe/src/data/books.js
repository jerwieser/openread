// The catalogue's books, from the API (titles, authors, and covers, years and links from Wikipedia,
// with our years and difficulty ratings), the classics and current books alike, plus the books readers
// suggested that an admin approved; and helpers to find, sort and show them. The site holds only some
// of them (see holdBooks in store.js): ours, the ones the rest of the site refers to, and the ones the
// reader has come across. The hooks at the end ask for the others: one book, a search, a page.
//
// The API sends each book as the original: its title in the language it was written in ("Война и мир",
// language "ru"), its titles in English and the reader's languages (its expressions), its one cover,
// and its authors with their names in those. Here a book gets the title and author the reader sees: in the first of their languages the book has them in, else English, else
// the original. "Misdaad en straf" by "Lev Tolstoj" for a reader
// whose browser asks for Dutch. catalogueTitle (English, else the original) and catalogueAuthor are
// the same whoever reads, for what mustn't change with the reader: a book's colours, matching
// imports. Books are found by their slugs, whatever they're called.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { browseBooks, holdBooks, read, searchBooks, useStore } from "../store.js";
import { ERAS } from "./catalogue.js";
import { READER_LANGUAGES, mainLanguage } from "./languages.js";

export const plain = (text) => text.normalize("NFKD").replace(/[̀-ͯ]/g, "");

export const sortKey = (title) => plain(title).replace(/^(the|a|an)\s+/i, "").toLowerCase();

export const slugify = (title) =>
  plain(title).toLowerCase().replace(/['’]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

export function formatYear(book) {
  if (book.year == null) return "";
  const year = book.year < 0 ? `${-book.year} BC` : String(book.year);
  return book.approximate ? `c. ${year}` : year;
}

// a title or name in the first of the reader's languages there is one in: its own (in ownLanguage),
// or one of the others ({ language: text }); else the English one, else its own. [text, language]
function inReaderLanguage(own, ownLanguage, others = {}) {
  for (const language of READER_LANGUAGES) {
    if (ownLanguage && mainLanguage(language) === ownLanguage) return [own, ownLanguage];
    if (others[language]) return [others[language], language];
  }
  return others.en ? [others.en, "en"] : [own, ownLanguage ?? undefined];
}

// "Leo Tolstoy", "David Graeber and David Wengrow", "A, B and C"; "Anonymous" for Beowulf
export function byline(names) {
  if (names.length > 1) return `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
  return names[0] ?? "Anonymous";
}

const prepare = (b) => {
  const [title, titleLanguage] = inReaderLanguage(b.title, b.language, b.titles);
  // an author's name as we write it is the English one
  const authors = (b.authors ?? []).map((p) => inReaderLanguage(p.name, "en", p.names)[0]);
  return {
    ...b,
    title,
    titleLanguage,
    catalogueTitle: b.titles?.en ?? b.title,
    originalTitle: b.language ? b.title : null,
    author: byline(authors),
    catalogueAuthor: byline((b.authors ?? []).map((p) => p.name)),
    // the first author's, for sorting by author and the drawn covers
    surname: authors[0]?.split(" ").at(-1) ?? "",
    era: b.year == null ? null : ERAS.find((e) => b.year < e.until).id,
  };
};

// every title a reader may know the book by: theirs, ours, the original
export const allTitles = (b) => [...new Set([b.title, b.catalogueTitle, b.originalTitle, ...Object.values(b.titles ?? {})].filter(Boolean))];

const byTitleOrder = (a, b) => sortKey(a.title).localeCompare(sortKey(b.title));

// every book the site holds, in title order; the same array until those change (an admin approves a
// suggestion, the reader comes across others), so it can be read straight from the store
let source;
let books = [];
let bySlug = new Map();
export function allBooks() {
  const list = read("books");
  if (list !== source) {
    source = list;
    books = list.map(prepare).sort(byTitleOrder);
    bySlug = new Map(books.map((b) => [b.slug, b]));
  }
  return books;
}

export const useBooks = () => useStore(allBooks);

// "the same book": the same title (any of the book's) and author (as the reader sees them or as we
// write them), ignoring case, accents and a leading "The"
const sameName = (x, y) => plain(x).trim().toLowerCase() === plain(y).trim().toLowerCase();
export const sameBook = (a, b) =>
  allTitles(a).some((t) => sortKey(t) === sortKey(b.title)) && (sameName(a.author, b.author) || sameName(a.catalogueAuthor ?? a.author, b.author));

export const bookBySlug = (slug) => (allBooks(), bySlug.get(slug));
export const eraById = (id) => ERAS.find((e) => e.id === id);

// how well a title or name matches what's typed: 2 when it starts with it, 1 when it holds it, 0 not
export const fit = (text, typed) => {
  const t = plain(text).toLowerCase();
  const q = plain(typed).trim().toLowerCase();
  return t.startsWith(q) ? 2 : t.includes(q) ? 1 : 0;
};

// the books that could be the one being typed, the best first: by any of their titles (in the
// reader's languages, ours, the original), else by author
export function findBooks(books, typed, limit = 5) {
  if (typed.trim().length < 2) return [];
  return books
    .map((b) => [b, Math.max(...allTitles(b).map((t) => fit(t, typed)), (fit(b.author, typed) || fit(b.catalogueAuthor, typed)) && 1)])
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([b]) => b);
}

export function matchesQuery(book, query) {
  const q = plain(query).trim().toLowerCase();
  return !q || plain(`${allTitles(book).join(" ")} ${book.author} ${book.catalogueAuthor}`).toLowerCase().includes(q);
}

// --- the books the site doesn't hold yet

// Whether these books (slugs) are held, asking for the ones that aren't: false until the API answers
export function useHeld(slugs) {
  const key = slugs.filter(Boolean).join(",");
  const [done, setDone] = useState(null);
  useEffect(() => {
    let current = true;
    holdBooks(key ? key.split(",") : []).finally(() => current && setDone(key));
    return () => {
      current = false;
    };
  }, [key]);
  return done === key;
}

// One book by its slug, asked for when the site doesn't hold it (a link to one nobody has come across
// here yet): the book, undefined while it comes, null when there's no such book
export function useBook(slug) {
  const held = useHeld([slug]);
  const book = useStore(() => bookBySlug(slug));
  return book ?? (held ? null : undefined);
}

// The books a search finds on the API, the best match first, a moment after the reader stops typing;
// until it answers, the books the site holds that fit what's typed
export function useBookSearch(typed, limit = 20) {
  const query = typed.trim();
  const [found, setFound] = useState({ query: "", slugs: null });
  const books = useBooks();
  useEffect(() => {
    if (query.length < 2) return undefined;
    let current = true;
    const timer = setTimeout(
      () => searchBooks(query, limit).then((slugs) => current && setFound({ query, slugs }), () => current && setFound({ query, slugs: null })),
      250,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [query, limit]);
  return useMemo(
    () => (found.query === query && found.slugs ? found.slugs.map(bookBySlug).filter(Boolean) : findBooks(books, query, limit)),
    [found, query, books, limit],
  );
}

// All the books, a page at a time (GET /works: { sort, difficulty, year_from, year_until, on_track,
// author }): { books, more, done, loaded }, more() asking for the next page, done once there are no
// more, loaded once the first page is in. New params start again from the top; null asks for none.
export function usePagedBooks(params, size = 48) {
  const key = JSON.stringify(params ?? null);
  const [list, setList] = useState({ key: null, slugs: [], done: false });
  const latest = useRef(list);
  latest.current = list;
  const wanted = useRef(key);
  wanted.current = key;
  const asking = useRef(null);
  const more = useCallback(async () => {
    const now = latest.current.key === key ? latest.current : { slugs: [], done: false };
    if (key === "null" || now.done || asking.current === key) return;
    asking.current = key;
    try {
      const slugs = await browseBooks({ ...JSON.parse(key), offset: now.slugs.length, limit: size });
      // a page for filters the reader has since changed is left out
      if (wanted.current === key) setList((l) => ({ key, slugs: [...(l.key === key ? l.slugs : []), ...slugs], done: slugs.length < size }));
    } catch (error) {
      console.error(error);
      if (wanted.current === key) setList((l) => ({ key, slugs: l.key === key ? l.slugs : [], done: true }));
    } finally {
      if (asking.current === key) asking.current = null;
    }
  }, [key, size]);
  useEffect(() => {
    more();
  }, [more]);
  const shown = list.key === key ? list : { slugs: [], done: false };
  const books = useStore(() => (allBooks(), bySlug));
  return {
    books: useMemo(() => shown.slugs.map((s) => books.get(s)).filter(Boolean), [shown.slugs, books]),
    more,
    done: shown.done,
    loaded: list.key === key,
  };
}
