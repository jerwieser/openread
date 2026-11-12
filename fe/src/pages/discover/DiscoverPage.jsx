// Discover (/discover): where readers find their next book, or a reading track that takes them through
// a subject, and put it on their bookshelf without leaving the page.
//
// One search box for everything, and three views of what it finds: All (tracks and books together,
// the best of each), Tracks (narrowed by tags) and Books (narrowed by category, period and order).
// Wherever a search comes up short there's somewhere to go: the topics spelt like it, the tracks the
// books found are on, Open Library's books that aren't here yet, suggesting a book, making a track.
// A book opens in a quick look over the page (BookQuickLook), with every shelf and the books like it.
//
// It all lives in the URL, so a search can be linked to and Back undoes the last step:
// ?q=orwell&view=books&category=classics&tags=cycling,doping&book=animal-farm. The old /books and
// /tracks lists land here (App.jsx).
import { useEffect, useRef } from "react";
import { Button, Container, Form, Nav } from "react-bootstrap";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";

import Icon from "../../components/Icon.jsx";
import { usePageTitle } from "../../components/PageHeader.jsx";
import { readingTracks } from "../../data/tracks.js";
import AllView from "./AllView.jsx";
import BookQuickLook from "./BookQuickLook.jsx";
import BooksView from "./BooksView.jsx";
import TracksView from "./TracksView.jsx";
import { allTopics, categoryTopics, tagTopics } from "./discover.js";
import { TopicChip } from "./parts.jsx";
import "./discover.css";

const VIEWS = {
  all: { label: "All", icon: "compass", placeholder: "Books, authors or subjects" },
  tracks: { label: "Tracks", icon: "signpost-split", placeholder: "Tracks by subject, book or author" },
  books: { label: "Books", icon: "bookmarks", placeholder: "Books by title or author, any language" },
};
// what each view filters by besides the search: dropped when the reader moves to another view
const FILTERS = { all: [], tracks: ["tags"], books: ["category", "era", "sort", "track", "difficulty"] };

// The view: the one asked for, else the one the filters belong to (links from a track's tags, the
// home page's books), else All
function viewOf(params) {
  const asked = params.get("view");
  if (VIEWS[asked]) return asked;
  if (params.get("tags")) return "tracks";
  if (FILTERS.books.some((key) => params.get(key))) return "books";
  return "all";
}

// The big search field: its icon, a cross to empty it, and "/" anywhere on the page to get to it
function SearchBox({ value, onChange, placeholder }) {
  const input = useRef(null);
  useEffect(() => {
    const onKey = (e) => {
      const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement?.tagName) || document.activeElement?.isContentEditable;
      if (e.key === "/" && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  return (
    <div className="discover-search position-relative mx-auto">
      <Icon name="search" className="discover-search-icon text-body-secondary" />
      <Form.Label htmlFor="discover-search" className="visually-hidden">
        Search
      </Form.Label>
      <Form.Control
        ref={input}
        id="discover-search"
        type="search"
        size="lg"
        className="rounded-pill shadow-sm"
        placeholder={placeholder}
        value={value}
        autoComplete="off"
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Escape" && onChange("")}
      />
      {value ? (
        <Button variant="link" className="discover-search-end link-secondary p-0" aria-label="Clear the search" onClick={() => onChange("")}>
          <Icon name="x-circle-fill" />
        </Button>
      ) : (
        <kbd className="discover-search-end d-none d-md-inline" title="Press / to search">
          /
        </kbd>
      )}
    </div>
  );
}

export default function DiscoverPage() {
  usePageTitle("Discover");
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const view = viewOf(params);
  const query = params.get("q") ?? "";

  // change some of the URL's values ("" takes one out); push makes it a step Back undoes
  const set = (changes, push = false) =>
    setParams(
      (p) => {
        for (const [key, value] of Object.entries(changes)) value ? p.set(key, value) : p.delete(key);
        return p;
      },
      { replace: !push },
    );

  // another view keeps the search but not the last view's filters
  const show = (next, extra = {}) => {
    const changes = { view: next === "all" ? "" : next, ...extra };
    for (const key of FILTERS[view]) if (!(key in extra)) changes[key] = "";
    set(changes, true);
  };
  // everything off but the view
  const clear = () => set(Object.fromEntries(["q", ...FILTERS[view]].map((key) => [key, ""])));
  // a topic chip: a tag shows its tracks, a category its books
  const onTopic = (topic) =>
    topic.kind === "tag" ? show("tracks", { tags: topic.id, q: "" }) : show("books", { category: topic.id, q: "" });

  // the quick look: opening one is a step, so Back closes it; closing one opened here goes back
  const openBook = (book) => {
    const p = new URLSearchParams(params);
    p.set("book", book.slug);
    navigate({ search: `?${p}` }, { replace: Boolean(params.get("book")), state: { quick: true } });
  };
  const closeBook = () => (location.state?.quick ? navigate(-1) : set({ book: "" }));

  const views = { all: AllView, tracks: TracksView, books: BooksView };
  const View = views[view];
  const popular = allTopics(tagTopics().slice(0, 9), categoryTopics().slice(0, 4));

  return (
    <>
      <section>
        <Container className="py-5 text-center position-relative">
          <h1 className="display-5 fw-bold text-body-emphasis mb-2">Discover</h1>
          <p className="lead text-body-secondary col-lg-7 mx-auto mb-4">
            Find your next book, or a reading track that takes you into a subject one book at a time. Shelve whatever catches your eye as you go.
          </p>
          <SearchBox value={query} onChange={(q) => set({ q })} placeholder={VIEWS[view].placeholder} />

          {/* the three views, as one segmented control */}
          <Nav variant="pills" className="discover-views d-inline-flex mt-4 p-1 bg-body rounded-pill shadow-sm" as="nav" aria-label="Show">
            {Object.entries(VIEWS).map(([key, { label, icon }]) => (
              <Nav.Item key={key}>
                <Nav.Link
                  as="button"
                  type="button"
                  className="rounded-pill px-3 px-sm-4 d-flex align-items-center gap-2"
                  active={view === key}
                  aria-current={view === key ? "page" : undefined}
                  onClick={() => view !== key && show(key)}
                >
                  <Icon name={icon} />
                  {label}
                  {key === "tracks" && <span className="discover-view-count">{readingTracks().length}</span>}
                </Nav.Link>
              </Nav.Item>
            ))}
          </Nav>

          {view === "all" && !query.trim() && (
            <div className="d-flex flex-wrap justify-content-center align-items-center gap-2 mt-4 col-xl-10 mx-auto">
              <span className="small fw-semibold text-body-secondary me-1">Popular topics</span>
              {/* on a phone the first six, so the results aren't pushed far down */}
              {popular.map((topic, i) => (
                <TopicChip
                  key={`${topic.kind}-${topic.id}`}
                  topic={{ ...topic, count: undefined }}
                  className={i >= 6 ? "d-none d-md-inline-block" : ""}
                  onClick={() => onTopic(topic)}
                />
              ))}
            </div>
          )}
        </Container>
      </section>

      <Container className="py-4 py-lg-5">
        <View params={params} set={set} show={show} clear={clear} onTopic={onTopic} onOpen={openBook} />
      </Container>

      <BookQuickLook slug={params.get("book")} onOpen={openBook} onClose={closeBook} />
    </>
  );
}
