import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Collapse, Container, Form, InputGroup, Row, Spinner } from "react-bootstrap";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import BookCard from "../components/BookCard.jsx";
import Icon, { IconCircle } from "../components/Icon.jsx";
import { BookCardPlaceholder, FilterBarPlaceholder, GridPlaceholder, Loader, PagedGrid, ScrollGrid } from "../components/Loading.jsx";
import { BOOK_GRID } from "../components/grids.js";
import OpenLibraryResults from "../components/OpenLibraryResults.jsx";
import PageHeader, { SeeAll } from "../components/PageHeader.jsx";
import { bookBySlug, matchesQuery, sortKey, useBooks, usePagedBooks } from "../data/books.js";
import { CATEGORIES, ERAS } from "../data/catalogue.js";
import { readingTracks } from "../data/tracks.js";
import { countBooks, searchBooks } from "../store.js";

// how the books can be ordered: by the API when browsing, here for a search's (which come the best
// match first, and stay so when the order is Popular)
const SORTS = {
  popular: ["Popular", null],
  title: ["Title", (a, b) => sortKey(a.title).localeCompare(sortKey(b.title))],
  oldest: ["Oldest first", (a, b) => (a.year ?? Infinity) - (b.year ?? Infinity)],
  newest: ["Newest first", (a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity)],
};

// the books that are on at least one of our reading tracks
const ON_A_TRACK = new Set(readingTracks().flatMap((t) => t.books.map((s) => s.book)));

// One category's shelf: a row of its popular books, nine from 1200px up where the grid has nine
// columns, six below, and a link to all of them
function CategoryShelf({ category }) {
  const { books, loaded } = usePagedBooks({ category: category.id, sort: "popular" }, 9);
  if (loaded && !books.length) return null;
  return (
    <section className="mb-5" aria-label={category.label}>
      <div className="d-flex justify-content-between align-items-baseline mb-3">
        <h2 className="h5 mb-0">{category.label}</h2>
        <SeeAll to={`/books?category=${category.id}`}>
          See all<span className="visually-hidden"> {category.label}</span>
        </SeeAll>
      </div>
      {loaded ? (
        <Row {...BOOK_GRID}>
          {books.map((b, i) => (
            <Col key={b.slug} className={i >= 6 ? "d-none d-xl-block" : undefined}>
              <BookCard book={b} />
            </Col>
          ))}
        </Row>
      ) : (
        <GridPlaceholder Item={BookCardPlaceholder} count={6} {...BOOK_GRID} />
      )}
    </section>
  );
}

// "1 book", "4,238 books", or the number as given ("100+ books")
const plural = (n, shown) => `${shown ?? n.toLocaleString("en")} ${n === 1 ? "book" : "books"}`;

// the years an era runs over, for the API: { year_from, year_until }, either open-ended
function eraYears(id) {
  const i = ERAS.findIndex((e) => e.id === id);
  if (i < 0) return {};
  return { year_from: i > 0 ? ERAS[i - 1].until : null, year_until: Number.isFinite(ERAS[i].until) ? ERAS[i].until : null };
}

export default function BooksPage() {
  // the books the site holds, for the moment before a search answers; the world's others come in
  // through the search, from Open Library
  const all = useBooks();
  const navigate = useNavigate();
  // filters live in the URL, so a filtered list can be linked to and survives a reload
  const [params, setParams] = useSearchParams();
  const query = params.get("q") ?? "";
  const era = params.get("era") ?? "";
  const category = CATEGORIES.some((c) => c.id === params.get("category")) ? params.get("category") : "";
  const onTrack = params.get("track") === "1";
  const sort = SORTS[params.get("sort")] ? params.get("sort") : "popular";
  const search = useDeferredValue(query);
  // the filters besides the search, folded away until the reader asks for them (or one is set)
  const advanced = Boolean(category || era || onTrack || params.get("sort"));
  const [showAdvanced, setShowAdvanced] = useState(advanced);
  // and shown when one is set from elsewhere, as by a shelf's "See all"
  useEffect(() => {
    if (advanced) setShowAdvanced(true);
  }, [advanced]);

  const set = (key, value) =>
    setParams((p) => {
      if (value) p.set(key, value);
      else p.delete(key);
      return p;
    }, { replace: true });

  // A search goes to the API, which finds every book on OpenRead by its title in any language and
  // its author's name in any spelling, the best match first ("oorlog en vrede", "dostoievski").
  // Until it answers, the books the site holds that have what's typed; a single letter is no search.
  const typed = search.trim();
  const [found, setFound] = useState({ query: "", slugs: null });
  useEffect(() => {
    if (typed.length < 2) return;
    let current = true;
    searchBooks(typed).then(
      (slugs) => current && setFound({ query: typed, slugs }),
      () => current && setFound({ query: typed, slugs: null }),
    );
    return () => {
      current = false;
    };
  }, [typed]);
  const searching = typed.length >= 2 && found.query !== typed;

  // Without a search: a shelf of popular books of each category (CategoryShelf); finding the others is
  // what the search is for. With the advanced filters, the books they leave, filtered and sorted by
  // the API a page at a time as the reader scrolls (54 a page: whole rows of the grid, whether it has
  // 2, 3, 6 or 9 columns).
  const searched = typed.length >= 2;
  const filters = !searched && advanced ? { sort, category, on_track: onTrack, ...eraYears(era) } : null;
  const browsing = usePagedBooks(filters, 54);
  // and how many they are in all, for the count above them
  const filtersKey = JSON.stringify(filters);
  const [total, setTotal] = useState({ key: null, count: null });
  useEffect(() => {
    if (filtersKey === "null") return undefined;
    let current = true;
    countBooks(JSON.parse(filtersKey)).then(
      (count) => current && setTotal({ key: filtersKey, count }),
      () => current && setTotal({ key: filtersKey, count: null }),
    );
    return () => {
      current = false;
    };
  }, [filtersKey]);

  const books = useMemo(() => {
    if (!searched) return [];
    const matched =
      found.query === typed && found.slugs
        ? found.slugs.map(bookBySlug).filter(Boolean)
        : all.filter((b) => matchesQuery(b, typed));
    const filtered = matched.filter(
      (b) => (!category || b.categories?.includes(category)) && (!era || b.era === era) && (!onTrack || ON_A_TRACK.has(b)),
    );
    // a search's results the best match first, unless the reader picked an order
    return SORTS[sort][1] ? filtered.toSorted(SORTS[sort][1]) : filtered;
  }, [all, found, typed, searched, category, era, onTrack, sort]);

  const filtered = query || advanced;

  return (
    <Container className="py-5">
      <PageHeader
        title="The books"
        actions={
          <Button as={Link} to="/books/suggest" variant="outline-primary" size="lg" className="px-4">
            Suggest a book
          </Button>
        }
      >
        Books from Homer to this year&apos;s novels. Search for any of them by title or author, in any language.
        Missing one? Suggest it.
      </PageHeader>

      {/* the page loads from the top down: the header at once, then the filters, then the books */}
      <Loader fallback={<FilterBarPlaceholder />}>
        <Card body className="mb-4 shadow-sm">
          {/* the search first and biggest: it's how the reader finds a book among all of them */}
          <Form.Label htmlFor="book-search" className="visually-hidden">
            Search the books
          </Form.Label>
          <InputGroup size="lg">
            <InputGroup.Text>
              <Icon name="search" />
            </InputGroup.Text>
            <Form.Control
              id="book-search"
              type="search"
              placeholder="Search by title or author, in any language"
              value={query}
              onChange={(e) => set("q", e.target.value)}
            />
          </InputGroup>

          <div className="d-flex justify-content-between align-items-center mt-2">
            <Button
              variant="link"
              className="p-0 small text-decoration-none"
              aria-expanded={showAdvanced}
              aria-controls="advanced-filters"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              Advanced filters <Icon name={showAdvanced ? "chevron-up" : "chevron-down"} />
            </Button>
            {filtered && (
              <Button variant="link" className="p-0 small text-decoration-none" onClick={() => setParams({}, { replace: true })}>
                Clear filters
              </Button>
            )}
          </div>

          <Collapse in={showAdvanced}>
            <div id="advanced-filters">
              <Row className="g-3 pt-3 align-items-end">
                <Col sm={6} lg={3}>
                  <Form.Label htmlFor="book-category">Category</Form.Label>
                  <Form.Select id="book-category" value={category} onChange={(e) => set("category", e.target.value)}>
                    <option value="">Any category</option>
                    {CATEGORIES.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col sm={6} lg={3}>
                  <Form.Label htmlFor="book-era">Period</Form.Label>
                  <Form.Select id="book-era" value={era} onChange={(e) => set("era", e.target.value)}>
                    <option value="">Any period</option>
                    {ERAS.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.label}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col sm={6} lg={3}>
                  <Form.Label htmlFor="book-sort">Sort</Form.Label>
                  <Form.Select id="book-sort" value={sort} onChange={(e) => set("sort", e.target.value === "popular" ? "" : e.target.value)}>
                    {Object.entries(SORTS).map(([key, [label]]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </Form.Select>
                </Col>
                <Col sm={6} lg={3}>
                  <Form.Check
                    type="switch"
                    id="on-track"
                    label="On a reading track"
                    className="mb-2"
                    checked={onTrack}
                    onChange={(e) => set("track", e.target.checked ? "1" : "")}
                  />
                </Col>
              </Row>
            </div>
          </Collapse>
        </Card>

        {/* How many books there are, centred over the grid: a search's on OpenRead (at most the hundred
            best: "100+"; the world's others, from Open Library, are below), or all the ones the filters
            leave; a small spinner while the list catches up with what's being typed */}
        <p className="small text-body-secondary d-flex justify-content-center align-items-center gap-2 mb-4" aria-live="polite">
          {query !== search || searching ? (
            <Spinner as="span" animation="border" size="sm" role="status">
              <span className="visually-hidden">Searching…</span>
            </Spinner>
          ) : searched ? (
            <>
              {plural(books.length, books.length >= 100 ? "100+" : null)} on OpenRead
              {/* ours are only the ones we have: the world's others are further down (from three letters) */}
              {typed.length >= 3 && (
                <>
                  <span aria-hidden="true">·</span>
                  <Button
                    variant="link"
                    size="sm"
                    className="p-0 align-baseline text-decoration-none"
                    // smoothly, unless the reader's system asks for less motion (Bootstrap's scroll-behavior)
                    onClick={() => document.getElementById("open-library")?.scrollIntoView()}
                  >
                    More books below
                  </Button>
                </>
              )}
            </>
          ) : (
            filters && total.key === filtersKey && total.count != null && plural(total.count)
          )}
        </p>
      </Loader>

      {!searched && !advanced ? (
        CATEGORIES.map((c) => <CategoryShelf key={c.id} category={c} />)
      ) : !searched && !browsing.loaded ? (
        <GridPlaceholder Item={BookCardPlaceholder} count={18} {...BOOK_GRID} />
      ) : !searched && browsing.books.length > 0 ? (
        <Loader fallback={<GridPlaceholder Item={BookCardPlaceholder} count={18} {...BOOK_GRID} />}>
          {/* a page at a time from the API, the next as the reader scrolls; new filters start again from the top */}
          <PagedGrid items={browsing.books} done={browsing.done} onMore={browsing.more} render={(b) => <BookCard book={b} />} {...BOOK_GRID} />
        </Loader>
      ) : searched && books.length > 0 ? (
        <Loader fallback={<GridPlaceholder Item={BookCardPlaceholder} count={18} {...BOOK_GRID} />}>
          {/* 54 at a time, more as the reader scrolls; new filters start again from the top */}
          <ScrollGrid
            key={`${search}|${category}|${era}|${onTrack}|${sort}`}
            items={books}
            batch={54}
            label="books"
            counted={false}
            render={(b) => <BookCard book={b} />}
            {...BOOK_GRID}
          />
        </Loader>
      ) : (
        <div className="text-center py-5">
          <IconCircle name="search" size={72} tone="secondary" />
          <p className="lead mt-3">No books match those filters.</p>
          <div className="d-flex flex-wrap justify-content-center gap-2">
            {query.trim() && (
              <Button as={Link} to={`/books/suggest?title=${encodeURIComponent(query.trim())}`}>
                Suggest “{query.trim()}”
              </Button>
            )}
            <Button variant="outline-primary" onClick={() => setParams({}, { replace: true })}>
              Clear the search and filters
            </Button>
          </div>
        </div>
      )}

      {/* beyond our own books: the world's, from Open Library, once there's a search */}
      <OpenLibraryResults id="open-library" query={search} pickLabel="Open" onPick={(book) => navigate(`/books/${book.slug}`)} />
    </Container>
  );
}
