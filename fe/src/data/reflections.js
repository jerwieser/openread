// Reflections: essays readers write about a book once they've read it, often after talking it
// through with other readers. The published ones come from the API, the reader's own drafts from the
// store; both are shaped the same way by toReflection.
import { read, useStore } from "../store.js";
import { readerById } from "./readers.js";

const words = (text) => text.trim().split(/\s+/).length;

// one shape for everyone's: paragraphs, the book, the writer's profile, and minutes to read
export function toReflection({ id, bookSlug, title, author, reader, date, createdAt, text, status }) {
  return {
    id,
    book: bookSlug,
    title,
    author,
    reader: readerById(reader),
    date: date ?? createdAt,
    paragraphs: text.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean),
    minutes: Math.max(1, Math.round(words(text) / 200)),
    status,
    own: reader === read("user")?.id,
  };
}

// everyone's published reflections, newest first, kept up to date
export function usePublishedReflections() {
  const list = useStore(() => read("reflections"));
  useStore(() => read("readers")); // the writers' names and photos
  return list.map(toReflection).sort((a, b) => b.date.localeCompare(a.date));
}

// a bare date ("2026-09-28") would be read as midnight UTC, which is the day before in the Americas
export const formatDate = (iso) =>
  new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric" }).format(
    new Date(iso.length === 10 ? `${iso}T12:00` : iso),
  );
