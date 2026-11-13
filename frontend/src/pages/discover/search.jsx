// A Discover search for books: on OpenRead (the API's best matches, by every title and every spelling
// of the author), and on Open Library for the ones that aren't here yet.
import { useDeferredValue, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { useMessage } from "../../components/Messages.jsx";
import OpenLibraryResults from "../../components/OpenLibraryResults.jsx";
import { bookBySlug, matchesQuery, useBooks } from "../../data/books.js";
import { searchBooks, useStatuses } from "../../store.js";

export { sortKey } from "../../data/books.js";

// The books a search finds, the best match first, at most a hundred: the API's once it answers, and
// until then the ones the site holds that have what's typed. A single letter is no search. searching
// while the answer is still coming.
export function useFoundBooks(query) {
  const deferred = useDeferredValue(query);
  const typed = deferred.trim();
  const all = useBooks();
  const [found, setFound] = useState({ query: "", slugs: null });
  useEffect(() => {
    if (typed.length < 2) return undefined;
    let current = true;
    const timer = setTimeout(
      () =>
        searchBooks(typed).then(
          (slugs) => current && setFound({ query: typed, slugs }),
          () => current && setFound({ query: typed, slugs: null }),
        ),
      200,
    );
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [typed]);
  const answered = found.query === typed;
  const books =
    typed.length < 2 ? [] : answered && found.slugs ? found.slugs.map(bookBySlug).filter(Boolean) : all.filter((b) => matchesQuery(b, typed)).slice(0, 100);
  return { typed, books, searching: typed.length >= 2 && (!answered || query.trim() !== typed) };
}

// Open Library's books for the search that aren't on OpenRead yet. One click adds it to OpenRead and
// puts it on the reader's Want to read (logged-out readers log in first and come back), and the message
// links to its page, so the reader can carry on searching.
export function NotHereYet({ query, id = "open-library" }) {
  const [, setStatus] = useStatuses();
  const message = useMessage();
  return (
    <div className="discover-elsewhere rounded-4 p-3 p-md-4 mt-5">
      <OpenLibraryResults
        id={id}
        query={query}
        Heading="h2"
        title="Not on OpenRead yet? Add it from Open Library"
        pickLabel="Want to read"
        onPick={async (book) => {
          await setStatus(book.slug, "want");
          message(
            <>
              <Link to={`/books/${book.slug}`} className="alert-link">
                <i>{book.titles?.en ?? book.title}</i>
              </Link>{" "}
              is on OpenRead now, and on your{" "}
              <Link to="/bookshelf?shelf=want" className="alert-link">
                Want to read
              </Link>{" "}
              shelf.
            </>,
          );
        }}
      />
    </div>
  );
}
