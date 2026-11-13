// Bringing a reader's books over from another reading site. Goodreads and The StoryGraph both let
// anyone export their library as a CSV file, one row per book with its title, author and where the
// reader is with it: read, currently-reading, to-read, and on The StoryGraph also did-not-finish and
// paused. The file is read in the browser; only the books' titles, authors and ISBNs go to the API,
// which finds which of them we have, then the statuses of those.
//
// The API matches them (POST /works/match): by ISBN, else by the author's surname and the title in
// any language, however it's spelled, as it tells two books apart (api/services/works.py, match). The catalogue
// is too big for the browser to hold, so it can't match them itself.
import { bookBySlug } from "./books.js";
import { matchBooks } from "../store.js";

// Each site we import from: its name, how to get the export there, and the export's columns. The
// StoryGraph's author column can name several authors, separated by commas; the first is the one.
export const SOURCES = {
  goodreads: {
    name: "Goodreads",
    site: "https://www.goodreads.com/review/import",
    steps: ["On Goodreads, go to My Books → Import and export.", "Click Export Library. Goodreads prepares the file, which can take a minute.", "Download goodreads_library_export.csv and choose it here."],
    columns: { title: "Title", author: "Author", status: "Exclusive Shelf", dateRead: "Date Read", isbn: "ISBN13" },
  },
  storygraph: {
    name: "The StoryGraph",
    site: "https://app.thestorygraph.com/",
    steps: ["On The StoryGraph, open the menu under your profile picture and go to Manage Account.", "Choose Export StoryGraph Library and generate the export, which can take a minute.", "Download the CSV file and choose it here."],
    columns: { title: "Title", author: "Authors", status: "Read Status", dateRead: "Last Date Read", isbn: "ISBN/UID" },
    firstAuthor: true,
  },
};

// RFC 4180 CSV: fields in quotes may hold commas, line breaks (reviews do) and doubled quotes
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += c;
  }
  if (field || row.length) rows.push([...row, field]);
  return rows;
}

// The export's books: { title, author, shelf, dateRead, isbn }. Throws when the file isn't one from
// that site.
export function readExport(source, text) {
  const { name, columns, firstAuthor } = SOURCES[source];
  const [header = [], ...lines] = parseCsv(text.replace(/^﻿/, ""));
  if ([columns.title, columns.author, columns.status].some((c) => !header.includes(c))) {
    throw new Error(`That doesn't look like an export from ${name}. Choose the CSV file ${name} gives you.`);
  }
  const at = (row, column) => (row[header.indexOf(column)] ?? "").trim();
  return lines
    .filter((row) => row.some((cell) => cell.trim()))
    .map((row) => {
      const author = at(row, columns.author);
      return {
        title: at(row, columns.title),
        author: firstAuthor ? author.split(",")[0].trim() : author,
        shelf: at(row, columns.status).toLowerCase(),
        dateRead: at(row, columns.dateRead) || null,
        // Goodreads writes ISBNs as ="9780141439471", so spreadsheets keep the digits
        isbn: at(row, columns.isbn).replace(/[="]/g, "") || null,
      };
    });
}

// The exports' shelves as our statuses: the shelves both sites have, The StoryGraph's did-not-finish
// and paused, and the shelves Goodreads readers make for books they put down or set aside, whatever
// they call them. Other shelves aren't imported.
export function statusFor(shelf) {
  if (shelf === "read") return "finished";
  if (shelf === "currently-reading") return "reading";
  if (shelf === "to-read") return "want";
  if (/dnf|did-not-finish|not-finished|unfinished|abandon|gave-up/.test(shelf)) return "stopped";
  if (/paus|on-hold/.test(shelf)) return "paused";
  return null;
}

// how far along each status is, for a book that's in the export twice (two editions)
const ALONG = { want: 0, paused: 1, stopped: 1, reading: 2, finished: 3 };

// The export against our books: matched ({ book, status, row }, one per book), the books we don't
// have ({ ...row, status }), and the rows on shelves we don't import
export async function matchExport(rows) {
  const wanted = rows.filter((row) => statusFor(row.shelf));
  const skipped = rows.filter((row) => !statusFor(row.shelf));
  const slugs = wanted.length ? await matchBooks(wanted) : [];
  const matched = new Map();
  const unmatched = [];
  wanted.forEach((row, i) => {
    const status = statusFor(row.shelf);
    const book = slugs[i] && bookBySlug(slugs[i]);
    if (!book) {
      unmatched.push({ ...row, status });
      return;
    }
    const before = matched.get(book.slug);
    if (!before || ALONG[status] > ALONG[before.status]) matched.set(book.slug, { book, status, row });
  });
  return { matched: [...matched.values()], unmatched, skipped };
}
