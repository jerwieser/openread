import { useEffect, useState } from "react";
import { Badge, Button, ListGroup, Spinner } from "react-bootstrap";

import { api } from "../api.js";
import { READER_LANGUAGES, languageName, mainLanguage } from "../data/languages.js";

// "und" (BCP 47's undetermined) for a title Open Library gave without saying in what language
const named = (code) => (code === "und" ? "Language unknown" : (languageName(code) ?? code));

// languages shown before "Show all": a well-read book is in a hundred
const FIRST_LANGUAGES = 4;
// editions asked for at a time: Pride and Prejudice has thousands in English
const PAGE = 20;

// the track cards' type (TrackCard.jsx): each language's name as a track's title, the rest as its text
const NAME = { fontSize: "0.9375rem" };
const TEXT = { fontSize: "0.8125rem" };

// A book's languages (GET /works/{slug}/expressions): its original first, then the reader's
// languages, then the ones with the most editions, then the rest by name. Null while they come.
export function useExpressions(slug) {
  const [loaded, setLoaded] = useState({ slug: null, expressions: null });
  useEffect(() => {
    let current = true;
    api.get(`/works/${slug}/expressions`).then(
      (expressions) => current && setLoaded({ slug, expressions }),
      () => current && setLoaded({ slug, expressions: [] }),
    );
    return () => {
      current = false;
    };
  }, [slug]);
  if (loaded.slug !== slug || !loaded.expressions) return null;
  const wanted = (x) => {
    const i = READER_LANGUAGES.findIndex((code) => code === x.language || code === mainLanguage(x.language));
    return i < 0 ? READER_LANGUAGES.length : i;
  };
  return loaded.expressions.toSorted(
    (a, b) =>
      b.original - a.original ||
      wanted(a) - wanted(b) ||
      b.editions - a.editions ||
      named(a.language).localeCompare(named(b.language)),
  );
}

// One edition: who published it when and its ISBN, as far as they're known
function Edition({ edition }) {
  const published = [edition.publisher, edition.year].filter(Boolean).join(", ");
  return (
    <li className="py-2 border-top lh-sm" style={TEXT}>
      <span>
        {published && <span className="d-block">{published}</span>}
        {edition.isbn && <span className={published ? "d-block text-body-secondary" : "d-block"}>ISBN {edition.isbn}</span>}
      </span>
    </li>
  );
}

// a language's editions, a page at a time, once its row is opened
function EditionList({ slug, expression }) {
  const [editions, setEditions] = useState([]);
  const [loading, setLoading] = useState(true);
  const page = (offset) =>
    api.get(`/works/${slug}/editions?language=${encodeURIComponent(expression.language)}&offset=${offset}&limit=${PAGE}`);
  // the first page as it opens (once, even when React runs this twice)
  useEffect(() => {
    let current = true;
    page(0)
      .then((first) => current && setEditions(first))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, []);
  const more = async () => {
    setLoading(true);
    try {
      const next = await page(editions.length);
      setEditions((shown) => [...shown, ...next]);
    } finally {
      setLoading(false);
    }
  };
  return (
    <div className="mt-2">
      <ul className="list-unstyled mb-0">
        {editions.map((e, i) => (
          <Edition key={e.olEdition ?? e.isbn ?? i} edition={e} />
        ))}
      </ul>
      {loading ? (
        <Spinner size="sm" className="mt-2" role="status" aria-label="Loading editions" />
      ) : (
        editions.length < expression.editions && (
          <Button variant="link" size="sm" className="px-0" style={TEXT} onClick={more}>
            Show more ({expression.editions - editions.length} to go)
          </Button>
        )
      )}
    </div>
  );
}

// One language: its title, whether it's the original, and its editions behind a button
function Expression({ slug, expression }) {
  const [open, setOpen] = useState(false);
  const { language, title, original, year, editions } = expression;
  return (
    <ListGroup.Item>
      <div className="d-flex flex-wrap align-items-center column-gap-3 row-gap-1">
        <span className="me-auto">
          <span className="fw-semibold" style={NAME}>
            {named(language)}
          </span>
          {original && (
            <Badge bg="primary-subtle" text="primary-emphasis" className="ms-2 fw-normal">
              Original
            </Badge>
          )}
          {title && (
            <span className="d-block text-body-secondary lh-sm" style={TEXT} lang={language}>
              <i>{title}</i>
              {year && `, ${year}`}
            </span>
          )}
        </span>
        {editions > 0 ? (
          <Button variant="link" size="sm" className="px-0" style={TEXT} aria-expanded={open} onClick={() => setOpen(!open)}>
            {open ? "Hide editions" : `${editions} ${editions === 1 ? "edition" : "editions"}`}
          </Button>
        ) : (
          <span className="text-body-secondary" style={TEXT}>
            No editions known
          </span>
        )}
      </div>
      {open && <EditionList slug={slug} expression={expression} />}
    </ListGroup.Item>
  );
}

// The book's languages, each with its editions: the most relevant first, the rest behind "Show all"
export default function Editions({ book, expressions }) {
  const [all, setAll] = useState(false);
  if (!expressions) {
    return (
      <div className="text-center">
        <Spinner size="sm" role="status" aria-label="Loading languages" />
      </div>
    );
  }
  const shown = all ? expressions : expressions.slice(0, FIRST_LANGUAGES);
  return (
    <div className="mx-auto" style={{ maxWidth: "40rem" }}>
      <ListGroup className="shadow-sm">
        {shown.map((x) => (
          <Expression key={x.language} slug={book.slug} expression={x} />
        ))}
      </ListGroup>
      {expressions.length > FIRST_LANGUAGES && (
        <div className="text-center mt-2">
          <Button variant="link" size="sm" style={TEXT} onClick={() => setAll(!all)}>
            {all ? "Show fewer languages" : `Show all ${expressions.length} languages`}
          </Button>
        </div>
      )}
    </div>
  );
}
