import { useState } from "react";
import { Button, Spinner } from "react-bootstrap";

import { formatYear, useBookSearch, useBooks, useHeld } from "../data/books.js";
import { addFromOpenLibrary, useStatuses } from "../store.js";
import BookCover from "./BookCover.jsx";
import Combobox from "./Combobox.jsx";
import { STATUSES } from "./BookStatus.jsx";
import { useMessage } from "./Messages.jsx";
import { useOpenLibrary } from "./OpenLibraryResults.jsx";

// the bookshelf's books in the order a reader most likely means them
const SHELF_ORDER = ["finished", "reading", "paused", "stopped", "want"];

const Details = ({ children }) => <div className="small opacity-75">{children}</div>;

function bookOption(book, onChoose, status) {
  return {
    key: book.slug,
    label: `${book.title} by ${book.author}`,
    content: (
      <>
        <div className="fw-medium">{book.title}</div>
        <Details>{[book.author, book.year != null && formatYear(book), status && STATUSES[status].label].filter(Boolean).join(" · ")}</Details>
      </>
    ),
    onChoose: () => onChoose(book),
  };
}

// Choosing one book, by searching for it: the books on the reader's bookshelf first (before they type
// anything too, the finished ones first), then the other books on OpenRead, by any of their titles or
// their author, then Open Library's, which are added to OpenRead when picked. The chosen book shows
// as a small card with a way to choose another. value: the chosen book's slug; name: the form field
// it's sent as.
export default function BookPicker({ id, name, value, onChange, isInvalid, placeholder = "Search by title or author" }) {
  const books = useBooks();
  const [statuses] = useStatuses();
  const [text, setText] = useState("");
  // the chosen book, which the site may not hold yet (a reflection's, say)
  useHeld([value]);
  const [adding, setAdding] = useState(null);
  const message = useMessage();
  const found = useOpenLibrary(text);
  const chosen = value && books.find((b) => b.slug === value);
  const typed = text.trim();

  const order = (b) => SHELF_ORDER.indexOf(statuses[b.slug]);
  const shelf = books.filter((b) => statuses[b.slug]).sort((a, b) => order(a) - order(b));
  // the books on OpenRead a search finds, by any of their titles or their author
  const matches = useBookSearch(typed, 8);
  const mine = typed ? matches.filter((b) => statuses[b.slug]).sort((a, b) => order(a) - order(b)) : shelf.slice(0, 8);
  const others = matches.filter((b) => !statuses[b.slug]).slice(0, 5);
  const works = (found.works ?? []).filter((w) => !books.some((b) => b.olWork === w.olWork)).slice(0, 5);

  function choose(book) {
    onChange(book.slug);
    setText("");
  }

  async function chooseWork(work) {
    setAdding(work.olWork);
    try {
      choose(await addFromOpenLibrary(work.olWork));
    } catch (error) {
      message(error.message, "danger");
    }
    setAdding(null);
  }

  if (chosen) {
    return (
      <div className={`d-flex align-items-center gap-3 border rounded p-2 ${isInvalid ? "border-danger" : ""}`}>
        <BookCover book={chosen} size="sm" />
        <div className="flex-grow-1">
          <div className="fw-medium">{chosen.title}</div>
          <div className="small text-body-secondary">
            {chosen.author}
            {chosen.year != null && ` · ${formatYear(chosen)}`}
          </div>
        </div>
        {/* the field's label points here once a book is chosen */}
        <Button id={id} variant="link" aria-label={`Change the book: ${chosen.title} is chosen`} onClick={() => onChange("")}>
          Change
        </Button>
        <input type="hidden" name={name} value={chosen.slug} />
      </div>
    );
  }

  const groups = [
    { label: typed ? "On your bookshelf" : "From your bookshelf", options: mine.map((b) => bookOption(b, choose, statuses[b.slug])) },
    { label: "On OpenRead", options: others.map((b) => bookOption(b, choose)) },
    {
      label: "From Open Library",
      options: works.map((w) => ({
        key: w.olWork,
        label: `${w.title}${w.author ? ` by ${w.author}` : ""}, from Open Library`,
        content: (
          <>
            <div className="fw-medium">{w.title}</div>
            <Details>{[w.author, w.year, `${w.editions} ${w.editions === 1 ? "edition" : "editions"}`].filter(Boolean).join(" · ")}</Details>
          </>
        ),
        onChoose: () => chooseWork(w),
      })),
    },
  ];
  return (
    <div className="position-relative">
      <Combobox value={text} onChange={setText} groups={groups} placeholder={placeholder} isInvalid={isInvalid} disabled={Boolean(adding)} />
      {adding && <Spinner animation="border" size="sm" role="status" className="position-absolute top-50 end-0 translate-middle-y me-3" />}
      {typed.length >= 2 && !matches.length && !works.length && !found.busy && (
        <div className="small text-body-secondary mt-1">No books found for “{typed}”. Try another spelling, or the author&apos;s name.</div>
      )}
    </div>
  );
}
