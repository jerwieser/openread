import { useState } from "react";
import { Ratio, Spinner } from "react-bootstrap";

// The book's real cover when Wikipedia has one and it loads; otherwise (no cover, or one that doesn't
// load) a white title page with a dark spine (layout.css). White, like the site's sheets, so it
// stays a book on the dark page instead of sinking into it.
const WIDTHS = { sm: 72, lg: 170, xl: 260, hero: 340 };

// While a cover loads: a small spinner on the cover's grey, where the cover will be, which fades in
// over it once it's there. Only when the page reaches it (loading="lazy"), and not for one the browser
// has already (complete when it's put on the page), which shows straight away.
function Picture({ src, title, onError }) {
  const [loaded, setLoaded] = useState(null);
  const ready = loaded === src;
  return (
    <div>
      {!ready && (
        <div className="position-absolute top-0 start-0 w-100 h-100 d-flex align-items-center justify-content-center">
          <Spinner animation="border" size="sm" className="text-body-tertiary" role="status">
            <span className="visually-hidden">Loading the cover…</span>
          </Spinner>
        </div>
      )}
      <img
        ref={(img) => img?.complete && img.naturalWidth > 0 && !ready && setLoaded(src)}
        src={src}
        alt={`Cover of ${title}`}
        loading="lazy"
        decoding="async"
        className="position-absolute top-0 start-0 w-100 h-100 object-fit-cover"
        style={{ opacity: ready ? 1 : 0, transition: "opacity 0.2s ease-in" }}
        onLoad={() => setLoaded(src)}
        onError={onError}
      />
    </div>
  );
}

export default function BookCover({ book, size = "md", className = "" }) {
  const width = WIDTHS[size];
  // the cover that didn't load, if one didn't (kept per address, so a new cover is tried again)
  const [failed, setFailed] = useState(null);
  return (
    <div className={`book-cover book-cover-${size} flex-shrink-0 ${className}`} style={width ? { width, maxWidth: "100%" } : undefined}>
      <Ratio aspectRatio={150} className="rounded shadow-sm overflow-hidden bg-white">
        {book.cover && book.cover !== failed ? (
          <Picture key={book.cover} src={book.cover} title={book.title} onError={() => setFailed(book.cover)} />
        ) : (
          <div className="book-cover-fallback" role="img" aria-label={`${book.title} by ${book.author}`}>
            <span className="book-cover-fallback-spine" aria-hidden="true" />
            <span className="book-cover-fallback-body">
              <span className="book-cover-fallback-rule" aria-hidden="true" />
              <span className="book-cover-fallback-title">{book.title}</span>
              {size !== "sm" && book.surname && <span className="book-cover-fallback-author">{book.surname}</span>}
            </span>
          </div>
        )}
      </Ratio>
    </div>
  );
}
