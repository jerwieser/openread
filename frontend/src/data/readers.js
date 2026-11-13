// The readers: the people who have read the books or are reading them now, answer other readers'
// questions. Each, from the API: { id, name, tagline, location, languages, fields, bio, photo, read,
// reading (books' slugs) }.
import { read } from "../store.js";
import { bookBySlug } from "./books.js";

// the three fields a reader can know well: the filters on the readers page
export const FIELDS = ["Literature", "History", "Philosophy"];

// the languages a reader can talk about books in, by their codes (see data/languages.js for their names)
export const LANGUAGES = ["en", "nl", "fr", "de", "es", "sv"];

// everyone, newest first
export const allReaders = () => read("readers");

export const readerById = (id) => allReaders().find((r) => r.id === id);

export const firstName = (person) => person.name.split(" ")[0];

// "Librarian · Manchester", leaving out whatever a reader didn't fill in
export const aboutLine = (reader) => [reader.tagline, reader.location].filter(Boolean).join(" · ");

// who has finished the book, and who is reading it now
export const readersWhoRead = (book) => allReaders().filter((r) => r.read.includes(book.slug));
export const readersReading = (book) => allReaders().filter((r) => r.reading.includes(book.slug));

// readers who have finished at least `min` of these books (slugs), most first
export function readersWhoKnow(slugs, min = 2) {
  return allReaders().map((r) => [r, r.read.filter((s) => slugs.includes(s)).length])
    .filter(([, n]) => n >= min)
    .sort((a, b) => b[1] - a[1])
    .map(([r]) => r);
}

// a book's era, for showing readers who know a book's period when nobody has read the book itself
export const readersForEra = (book) =>
  allReaders().filter((r) => r.read.some((s) => bookBySlug(s)?.era === book.era && s !== book.slug));
