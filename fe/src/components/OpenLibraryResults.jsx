import { useEffect, useState } from "react";
import { Button, ListGroup, Spinner } from "react-bootstrap";
import { useLocation, useNavigate } from "react-router-dom";

import { api } from "../api.js";
import { useBooks } from "../data/books.js";
import { addFromOpenLibrary, useUser } from "../store.js";
import { useMessage } from "./Messages.jsx";

// The world's other books for a search: Open Library's works that aren't on OpenRead yet, asked
// through our API (api/routers/catalogue.py) once the reader stops typing. Picking one adds it to
// OpenRead, the first time anyone does, and hands the book to onPick: the books page opens it, the
// track editor puts it on the track. Logged-out readers log in first. Heading: its heading's level
// where it sits ("h2" on a page, lower inside a card). title: the section's heading, if not the usual.
const plural = (n, one) => `${n} ${n === 1 ? one : `${one}s`}`;

export function useOpenLibrary(query) {
  const [state, setState] = useState({ query: "", works: [], busy: false });
  const q = query.trim();
  useEffect(() => {
    if (q.length < 3) return undefined;
    let current = true;
    setState((s) => ({ ...s, busy: true }));
    // after a pause in the typing, and only the newest search's answer counts
    const timer = setTimeout(async () => {
      let works = [];
      try {
        works = await api.get(`/works/search?q=${encodeURIComponent(q)}`);
      } catch {
        works = null;
      }
      if (current) setState({ query: q, works, busy: false });
    }, 400);
    return () => {
      current = false;
      clearTimeout(timer);
    };
  }, [q]);
  return q.length < 3 ? { query: q, works: [], busy: false } : state;
}

export default function OpenLibraryResults({ id, query, pickLabel, onPick, Heading = "h2", title = "More books from Open Library" }) {
  const found = useOpenLibrary(query);
  // the works picked since the search came back are on OpenRead now, among our own results
  const books = useBooks();
  const works = found.works && found.works.filter((w) => !books.some((b) => b.olWork === w.olWork));
  const { busy } = found;
  const user = useUser();
  const navigate = useNavigate();
  const { pathname, search } = useLocation();
  const message = useMessage();
  const [adding, setAdding] = useState(null);
  if (query.trim().length < 3) return null;

  async function pick(work) {
    if (!user) return navigate(`/log-in?next=${encodeURIComponent(pathname + search)}`);
    setAdding(work.olWork);
    try {
      onPick(await addFromOpenLibrary(work.olWork));
    } catch (error) {
      message(error.message, "danger");
    }
    setAdding(null);
  }

  return (
    <section id={id} className="mt-4" aria-live="polite">
      <Heading className="h6 text-body-secondary d-flex align-items-center gap-2">
        {title}
        {busy && <Spinner animation="border" size="sm" role="status" aria-label="Searching Open Library" />}
      </Heading>
      {works === null ? (
        <p className="small text-body-secondary">Open Library isn&apos;t answering right now. Try again in a moment.</p>
      ) : works.length === 0 ? (
        !busy && <p className="small text-body-secondary">Nothing more there for “{query.trim()}”.</p>
      ) : (
        <ListGroup>
          {works.map((w) => (
            <ListGroup.Item key={w.olWork} className="d-flex align-items-center gap-3">
              {w.cover ? (
                <img src={w.cover} alt="" width={36} height={54} className="rounded object-fit-cover flex-shrink-0 bg-body-tertiary" loading="lazy" />
              ) : (
                <span className="rounded bg-body-tertiary flex-shrink-0" style={{ width: 36, height: 54 }} aria-hidden="true" />
              )}
              <span className="flex-grow-1 min-w-0">
                <span className="d-block text-truncate" title={w.title}>
                  {w.title}
                </span>
                <span className="d-block small text-body-secondary text-truncate">
                  {[w.author, w.year, w.editions > 1 && plural(w.editions, "edition")].filter(Boolean).join(" · ")}
                </span>
              </span>
              {/* adding one takes a moment (Open Library, then Wikidata): a spinner on it, and no
                  picking another meanwhile */}
              <Button
                size="sm"
                variant="outline-primary"
                className="d-inline-flex align-items-center gap-2 flex-shrink-0"
                disabled={adding !== null}
                aria-busy={adding === w.olWork}
                onClick={() => pick(w)}
              >
                {adding === w.olWork && <Spinner as="span" animation="border" size="sm" aria-hidden="true" />}
                {pickLabel}
                <span className="visually-hidden">: {w.title}</span>
              </Button>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
      <p className="small text-body-secondary mt-2 mb-0">
        From Open Library, the open catalogue of the world&apos;s books.
      </p>
    </section>
  );
}
