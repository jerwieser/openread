import { Link } from "react-router-dom";

import BookCover from "./BookCover.jsx";

// A book as its cover only. The title, who wrote it, how hard it is and where it sits on the
// bookshelf are on the cover itself when it has no picture, and on the book's page either way.
// A click opens that page. onOpen: on Discover, a click opens the book in a quick look over the
// page instead (with the keys that open a link elsewhere, like Cmd-click, it still opens the
// book's own page).
const elsewhere = (e) => e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;

export default function BookCard({ book, onOpen }) {
  const by = book.author ? `, ${book.author}` : "";
  return (
    <Link
      to={`/books/${book.slug}`}
      className="d-block"
      aria-label={`${book.title}${by}`}
      onClick={
        onOpen &&
        ((e) => {
          if (elsewhere(e)) return;
          e.preventDefault();
          onOpen(book);
        })
      }
    >
      <BookCover book={book} className="w-100" />
    </Link>
  );
}
