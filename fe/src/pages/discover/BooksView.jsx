// Discover's Books view: every book on OpenRead, as the books page had them. Without a search or
// filters, a shelf of popular books for each category; with filters, all the books they leave, a page
// at a time from the API; with a search, the API's best matches, then Open Library's books that
// aren't on OpenRead yet, which a click puts on the reader's Want to read.
import { useEffect, useMemo, useState } from "react";
import { Button, Card, Col, Form, Row, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";

import BookCard from "../../components/BookCard.jsx";
import { IconCircle } from "../../components/Icon.jsx";
import { BookCardPlaceholder, GridPlaceholder, Loader, PagedGrid, ScrollGrid } from "../../components/Loading.jsx";
import { usePagedBooks } from "../../data/books.js";
import { CATEGORIES, ERAS } from "../../data/catalogue.js";
import { readingTracks } from "../../data/tracks.js";
import { countBooks } from "../../store.js";
import { BOOKS, SectionTitle, SeeAllButton } from "./parts.jsx";
import { NotHereYet, sortKey, useFoundBooks } from "./search.jsx";

// how the books can be ordered: by the API when browsing, here for a search's (which come the best
// match first, and stay so when the order is Popular)
export const SORTS = {
  popular: ["Popular", null],
  title: ["Title", (a, b) => sortKey(a.title).localeCompare(sortKey(b.title))],
  oldest: ["Oldest first", (a, b) => (a.year ?? Infinity) - (b.year ?? Infinity)],
  newest: ["Newest first", (a, b) => (b.year ?? -Infinity) - (a.year ?? -Infinity)],
  // a search's results stay the best match first: the site doesn't know when each was added
  added: ["Recently added", null],
};


// "1 book", "4,238 books", or the number as given ("100+ books")
export const plural = (n, shown) => `${shown ?? n.toLocaleString("en")} ${n === 1 ? "book" : "books"}`;

// the years an era runs over, for the API: { year_from, year_until }, either open-ended
function eraYears(id) {
  const i = ERAS.findIndex((e) => e.id === id);
  if (i < 0) return {};
  return { year_from: i > 0 ? ERAS[i - 1].until : null, year_until: Number.isFinite(ERAS[i].until) ? ERAS[i].until : null };
}

// A shelf of books: a row of them (params: GET /works's), nine from 1200px up where the grid has
// nine columns, six below, and the way to all of them
export function Shelf({ title, icon = "bookmarks", tone = "secondary", params, children, onOpen, onSeeAll }) {
  const { books, loaded } = usePagedBooks(params, 9);
  if (loaded && !books.length) return null;
  return (
    <section className="mb-5" aria-label={title}>
      <SectionTitle
        icon={icon}
        tone={tone}
        title={title}
        action={
          <SeeAllButton onClick={onSeeAll}>
            See all<span className="visually-hidden"> {title}</span>
          </SeeAllButton>
        }
      >
        {children}
      </SectionTitle>
      {loaded ? (
        <Row {...BOOKS}>
          {books.map((b, i) => (
            <Col key={b.slug} className={i >= 6 ? "d-none d-xl-block" : undefined}>
              <BookCard book={b} onOpen={onOpen} />
            </Col>
          ))}
        </Row>
      ) : (
        <GridPlaceholder Item={BookCardPlaceholder} count={6} {...BOOKS} />
      )}
    </section>
  );
}

// one category's popular books
export const CategoryShelf = ({ category, ...props }) => (
  <Shelf title={category.label} params={{ category: category.id, sort: "popular" }} {...props} />
);

// The books most recently added to OpenRead, whatever their category: a reader's pick from Open
// Library, an upload. Many have no category (Open Library's subjects say little about most books
// outside English), and this is where those show without a search.
export const RecentShelf = (props) => (
  <Shelf title="Recently added" icon="clock" tone="info" params={{ sort: "added" }} {...props}>
    New on OpenRead, picked by readers or added by us.
  </Shelf>
);

// the books on at least one of our reading tracks
const onATrack = () => new Set(readingTracks().flatMap((t) => t.books.map((s) => s.book)));

export default function BooksView({ params, set, clear, onOpen }) {
  const query = params.get("q") ?? "";
  const era = params.get("era") ?? "";
  const category = CATEGORIES.some((c) => c.id === params.get("category")) ? params.get("category") : "";
  const onTrack = params.get("track") === "1";
  const difficulty = params.get("difficulty") ?? "";
  const sort = SORTS[params.get("sort")] ? params.get("sort") : "popular";
  const filtered = Boolean(category || era || onTrack || difficulty || params.get("sort"));

  const { typed, books: found, searching } = useFoundBooks(query);
  const searched = typed.length >= 2;

  // without a search, the books the filters leave, a page at a time (54: whole rows of the grid,
  // whether it has 2, 3, 6 or 9 columns), and how many they are in all
  const filters = !searched && filtered ? { sort, category, difficulty, on_track: onTrack, ...eraYears(era) } : null;
  const browsing = usePagedBooks(filters, 54);
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

  // a search's books, filtered here, the best match first unless the reader picked an order
  const books = useMemo(() => {
    if (!searched) return [];
    const tracked = onTrack ? onATrack() : null;
    const left = found.filter(
      (b) =>
        (!category || b.categories?.includes(category)) &&
        (!era || b.era === era) &&
        (!difficulty || b.difficulty === difficulty) &&
        (!tracked || tracked.has(b)),
    );
    return SORTS[sort][1] ? left.toSorted(SORTS[sort][1]) : left;
  }, [found, searched, category, era, difficulty, onTrack, sort]);

  return (
    <>
      {/* the filters besides the search, always in sight: four small fields in a row */}
      <Card body className="discover-filters mb-4 border-0 shadow-sm">
        <Row className="g-3 align-items-end">
          <Col xs={6} lg={3}>
            <Form.Label htmlFor="book-category" className="small fw-medium mb-1">
              Category
            </Form.Label>
            <Form.Select id="book-category" size="sm" value={category} onChange={(e) => set({ category: e.target.value })}>
              <option value="">Any category</option>
              {CATEGORIES.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col xs={6} lg={3}>
            <Form.Label htmlFor="book-era" className="small fw-medium mb-1">
              Period
            </Form.Label>
            <Form.Select id="book-era" size="sm" value={era} onChange={(e) => set({ era: e.target.value })}>
              <option value="">Any period</option>
              {ERAS.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.label}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col xs={6} lg={3}>
            <Form.Label htmlFor="book-sort" className="small fw-medium mb-1">
              Sort
            </Form.Label>
            <Form.Select id="book-sort" size="sm" value={sort} onChange={(e) => set({ sort: e.target.value === "popular" ? "" : e.target.value })}>
              {Object.entries(SORTS).map(([key, [label]]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </Form.Select>
          </Col>
          <Col xs={6} lg={3} className="d-flex align-items-center justify-content-between gap-2">
            <Form.Check type="switch" id="on-track" label="On a reading track" checked={onTrack} onChange={(e) => set({ track: e.target.checked ? "1" : "" })} />
            {(filtered || query) && (
              <Button variant="link" size="sm" className="p-0 text-decoration-none text-nowrap" onClick={clear}>
                Clear all
              </Button>
            )}
          </Col>
        </Row>
      </Card>

      {/* how many: a search's on OpenRead (at most the hundred best: "100+"), or all the filters leave */}
      <p className="small text-body-secondary d-flex justify-content-center align-items-center gap-2 mb-4" aria-live="polite">
        {searching ? (
          <Spinner as="span" animation="border" size="sm" role="status">
            <span className="visually-hidden">Searching…</span>
          </Spinner>
        ) : searched ? (
          `${plural(books.length, books.length >= 100 ? "100+" : null)} on OpenRead`
        ) : (
          filters && total.key === filtersKey && total.count != null && plural(total.count)
        )}
      </p>

      {!searched && !filtered ? (
        <>
          <RecentShelf onOpen={onOpen} onSeeAll={() => set({ sort: "added" }, true)} />
          {CATEGORIES.map((c) => (
            <CategoryShelf key={c.id} category={c} onOpen={onOpen} onSeeAll={() => set({ category: c.id }, true)} />
          ))}
        </>
      ) : !searched && !browsing.loaded ? (
        <GridPlaceholder Item={BookCardPlaceholder} count={18} {...BOOKS} />
      ) : !searched && browsing.books.length > 0 ? (
        <PagedGrid items={browsing.books} done={browsing.done} onMore={browsing.more} render={(b) => <BookCard book={b} onOpen={onOpen} />} {...BOOKS} />
      ) : searched && books.length > 0 ? (
        <Loader fallback={<GridPlaceholder Item={BookCardPlaceholder} count={18} {...BOOKS} />}>
          <ScrollGrid
            key={`${typed}|${category}|${era}|${onTrack}|${sort}|${difficulty}`}
            items={books}
            batch={54}
            label="books"
            counted={false}
            render={(b) => <BookCard book={b} onOpen={onOpen} />}
            {...BOOKS}
          />
        </Loader>
      ) : (
        !searching && (
          <div className="text-center py-5">
            <IconCircle name="search" size={72} tone="secondary" />
            <p className="lead mt-3">No books on OpenRead match {searched ? <>“{typed}”</> : "those filters"}.</p>
            <div className="d-flex flex-wrap justify-content-center gap-2">
              {filtered && (
                <Button variant="outline-primary" onClick={() => set({ category: "", era: "", sort: "", track: "", difficulty: "" })}>
                  Drop the filters
                </Button>
              )}
              <Button as={Link} to={`/books/suggest${searched ? `?title=${encodeURIComponent(typed)}` : ""}`} variant="outline-secondary">
                Suggest a book
              </Button>
            </div>
          </div>
        )
      )}

      {searched && <NotHereYet query={typed} />}
    </>
  );
}
