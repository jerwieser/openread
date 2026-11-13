import { useMemo, useState } from "react";
import { Button, Card, CloseButton, Col, Container, Form, Row } from "react-bootstrap";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { RequireLogin } from "../components/Auth.jsx";
import { SubtleBadge } from "../components/Badges.jsx";
import BookCover from "../components/BookCover.jsx";
import BusyButton from "../components/BusyButton.jsx";
import Combobox from "../components/Combobox.jsx";
import { ListPlaceholder, Loader } from "../components/Loading.jsx";
import { useMessage } from "../components/Messages.jsx";
import { useOpenLibrary } from "../components/OpenLibraryResults.jsx";
import PageHeader, { Note, SectionHeader } from "../components/PageHeader.jsx";
import { allTitles, fit, formatYear, plain, sameBook, sortKey, useBookSearch, useBooks } from "../data/books.js";
import { useSuggestions, useUser } from "../store.js";

const THIS_YEAR = new Date().getFullYear();

const SUGGESTION_STATUS = { pending: ["warning", "Waiting for review"], approved: ["success", "Added"], rejected: ["secondary", "Not added"] };

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long" }); // the site is in English

// the books the reader suggested before, and what the admins decided, under the form
function Suggestions() {
  const user = useUser();
  const [suggestions] = useSuggestions();
  const books = useBooks();
  const mine = suggestions.filter((s) => s.email === user.email);
  if (!mine.length) return null;
  return (
    <section className="mt-5" id="your-suggestions">
      <SectionHeader title="Your suggestions">The books you asked us to add, and where each one stands.</SectionHeader>
      {mine.length > 0 && (
        <Loader fallback={<ListPlaceholder rows={Math.min(mine.length, 3)} avatar={0} />}>
          <Row className="justify-content-center">
            <Col lg={8}>
              <ul className="list-group shadow-sm">
                {mine.map((s) => {
                  const [tone, label] = SUGGESTION_STATUS[s.status];
                  const book = s.book && books.find((b) => b.slug === s.book);
                  return (
                    <li key={s.id} className="list-group-item d-flex flex-wrap align-items-center gap-3 py-3">
                      <div className="flex-grow-1">
                        {book ? (
                          <Link to={`/books/${book.slug}`} className="fw-medium link-body-emphasis">
                            {s.title}
                          </Link>
                        ) : (
                          <span className="fw-medium">{s.title}</span>
                        )}
                        <div className="small text-body-secondary">
                          {s.author} · suggested {dateFormat.format(new Date(s.createdAt))}
                          {s.status === "rejected" && s.reason && ` · ${s.reason}`}
                        </div>
                      </div>
                      <SubtleBadge tone={tone}>{label}</SubtleBadge>
                    </li>
                  );
                })}
              </ul>
            </Col>
          </Row>
        </Loader>
      )}
    </section>
  );
}

const sameName = (a, b) => plain(a).trim().toLowerCase() === plain(b).trim().toLowerCase();

// a suggestion's authors in one line, the way the API splits them again ("A and B")
const joined = (names) => names.join(" and ");

// the people who wrote the books on OpenRead, with how many each: the authors to choose from
function usePeople(books) {
  return useMemo(() => {
    const people = new Map();
    for (const b of books) for (const p of b.authors ?? []) people.set(p.slug, { ...p, books: (people.get(p.slug)?.books ?? 0) + 1 });
    return [...people.values()];
  }, [books]);
}

// the line under an option: by whom, when, and where it's from
const Details = ({ children }) => <div className="small opacity-75">{children}</div>;

// The title, which is also a search: while the reader types, the books we have that it could be (by
// any of their titles, in any of the reader's languages, or their author), the reader's own
// suggestions waiting for review, and Open Library's books, which fill in the rest of the form.
// The last choice is always to go on with what's typed, as a new book.
function TitleField({ title, setTitle, books, mine, onOurs, onWork, onMine, isInvalid }) {
  const typed = title.trim();
  const found = useOpenLibrary(title);
  // the API's search, whose books the site holds from then on, so the form below knows them too
  const ours = useBookSearch(typed, 5);
  const waiting = typed.length >= 2 ? mine.filter((s) => s.status === "pending" && fit(s.title, typed)).slice(0, 3) : [];
  const works = (found.works ?? []).filter((w) => !books.some((b) => b.olWork === w.olWork)).slice(0, 5);
  const exact = ours.some((b) => allTitles(b).some((t) => sameName(t, typed)));
  const groups = [
    {
      label: "On OpenRead",
      options: ours.map((b) => ({
        key: b.slug,
        label: `${b.title} by ${b.author}`,
        content: (
          <>
            <div className="fw-medium">{b.title}</div>
            <Details>
              {b.author}
              {b.year != null && ` · ${formatYear(b)}`}
            </Details>
          </>
        ),
        onChoose: () => onOurs(b),
      })),
    },
    {
      label: "You suggested",
      options: waiting.map((s) => ({
        key: `suggestion-${s.id}`,
        label: `${s.title} by ${s.author}, waiting for review`,
        content: (
          <>
            <div className="fw-medium">{s.title}</div>
            <Details>{s.author} · waiting for review</Details>
          </>
        ),
        onChoose: () => onMine(s),
      })),
    },
    {
      label: "From Open Library",
      options: works.map((w) => ({
        key: w.olWork,
        label: `${w.title}${w.author ? ` by ${w.author}` : ""}`,
        content: (
          <>
            <div className="fw-medium">{w.title}</div>
            <Details>
              {[w.author, w.year, `${w.editions} ${w.editions === 1 ? "edition" : "editions"}`].filter(Boolean).join(" · ")}
            </Details>
          </>
        ),
        onChoose: () => onWork(w),
      })),
    },
    {
      options:
        typed && !exact
          ? [
              {
                key: "new",
                label: `Suggest “${typed}” as a new book`,
                content: (
                  <span>
                    Suggest <b>“{typed}”</b> as a new book
                  </span>
                ),
                onChoose: () => {},
              },
            ]
          : [],
    },
  ];
  return (
    <Combobox
      name="title"
      required
      maxLength={150}
      value={title}
      onChange={setTitle}
      groups={groups}
      placeholder="Start typing, and pick it if it's there"
      isInvalid={isInvalid}
    />
  );
}

// The authors, one or more, each a person: one of the authors of our books, or someone new. Enter or
// a comma adds what's typed; Backspace in the empty field takes the last one off again.
function AuthorsField({ authors, setAuthors, people, isInvalid }) {
  const [text, setText] = useState("");
  const typed = text.trim();
  const chosen = (name) => authors.some((a) => sameName(a, name));
  const matches = typed
    ? people
        .filter((p) => fit(p.name, typed) && !chosen(p.name))
        .sort((a, b) => fit(b.name, typed) - fit(a.name, typed) || b.books - a.books)
        .slice(0, 6)
    : [];
  const add = (name) => {
    if (name && !chosen(name)) setAuthors([...authors, name]);
    setText("");
  };
  // what's typed, as the person we have by that name if there is one
  const addTyped = () => add(people.find((p) => sameName(p.name, typed))?.name ?? typed);
  const known = people.some((p) => sameName(p.name, typed));
  const groups = [
    {
      label: "Authors on OpenRead",
      options: matches.map((p) => ({
        key: p.slug,
        label: p.name,
        content: (
          <>
            <div className="fw-medium">{p.name}</div>
            <Details>{p.books === 1 ? "1 book" : `${p.books} books`} on OpenRead</Details>
          </>
        ),
        onChoose: () => add(p.name),
      })),
    },
    {
      options:
        typed && !known && !chosen(typed)
          ? [
              {
                key: "new",
                label: `Add “${typed}” as a new author`,
                content: (
                  <span>
                    Add <b>“{typed}”</b> as a new author
                  </span>
                ),
                onChoose: addTyped,
              },
            ]
          : [],
    },
  ];
  return (
    <Combobox
      value={text}
      onChange={(value) => (value.endsWith(",") ? add(value.slice(0, -1).trim()) : setText(value))}
      groups={groups}
      placeholder={authors.length ? "Another author" : "Start typing a name"}
      className={isInvalid ? "is-invalid" : ""}
      onBlur={() => typed && addTyped()}
      onKeyDown={(e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          if (typed) addTyped();
        } else if (e.key === "Backspace" && !text && authors.length) {
          setAuthors(authors.slice(0, -1));
        }
      }}
    >
      {authors.map((name) => (
        <span key={name} className="badge rounded-pill text-bg-light border d-inline-flex align-items-center gap-1 fw-medium fs-6">
          {name}
          <CloseButton aria-label={`Remove ${name}`} className="ms-1" style={{ fontSize: "0.6rem" }} onClick={() => setAuthors(authors.filter((a) => a !== name))} />
        </span>
      ))}
    </Combobox>
  );
}

// Suggesting a book that isn't on OpenRead yet (/books/suggest, ?title= to start from a search).
// The title and the authors are searches over what we have, so a book is found rather than typed
// again: picking one of ours says it's here already; picking one of Open Library's fills in the
// rest and remembers which work it is, so it can't be suggested twice under two spellings; a book we
// have as a plain record from Open Library can be suggested for the catalogue. Whatever the reader
// types, the same book (in any of our languages, with the same authors) or one already waiting for
// review can't be suggested again. An admin approves or rejects each suggestion.
function Suggest() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const message = useMessage();
  const books = useBooks();
  const people = usePeople(books);
  const [suggestions, addSuggestion] = useSuggestions();
  const user = useUser();
  const mine = suggestions.filter((s) => s.email === user.email);
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [authors, setAuthors] = useState([]);
  const [year, setYear] = useState("");
  const [cover, setCover] = useState("");
  // the Open Library work it is, once picked; one of our books picked, which is here already
  const [olWork, setOlWork] = useState(null);
  const [picked, setPicked] = useState(null);
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);

  const draft = { title: title.trim(), author: joined(authors) };
  const sameAuthors = (b) => b.authors?.length === authors.length && b.authors.every((p, i) => sameName(p.name, authors[i]));
  const sameTitle = (b) => allTitles(b).some((t) => sortKey(t) === sortKey(draft.title));
  // what's typed, as a book on OpenRead already, which can't be suggested (null rather than a falsy
  // 0 or "", which React would show on the page)
  const complete = Boolean(draft.title && authors.length);
  const existing = complete ? books.find((b) => (olWork ? b.olWork === olWork : sameTitle(b) && sameAuthors(b))) ?? null : null;
  const waiting = complete ? mine.find((s) => s.status === "pending" && (olWork ? s.olWork === olWork : sameBook(s, draft))) : null;
  // a stand-in book for the preview, with the plain cover when there's no picture yet
  const preview = { title: draft.title || "Title", author: draft.author || "Author", surname: authors[0]?.split(" ").at(-1) || "Author", cover: cover.trim() || null };

  // a book picked from Open Library: the rest filled in
  function fillFrom(book) {
    setTitle(book.title);
    setAuthors(book.authors ? book.authors.map((p) => p.name) : book.author ? [people.find((p) => sameName(p.name, book.author))?.name ?? book.author] : []);
    setYear(book.year != null ? String(book.year) : "");
    setCover(book.cover ?? "");
    setOlWork(book.olWork ?? null);
  }

  function changeTitle(value) {
    setTitle(value);
    // typing on after picking a book: it's another book now
    if (olWork) setOlWork(null);
  }

  function startOver() {
    setPicked(null);
    setTitle("");
    setAuthors([]);
    setYear("");
    setCover("");
    setOlWork(null);
    setValidated(false);
  }

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity() || !authors.length || existing || waiting) {
      setValidated(true);
      return;
    }
    const f = Object.fromEntries(new FormData(form));
    setBusy(true);
    try {
      await addSuggestion({
        title: draft.title,
        author: draft.author,
        year: year ? Number(year) : null,
        url: f.url.trim() || null,
        cover: cover.trim() || null,
        note: f.note.trim(),
        olWork,
      });
    } catch (error) {
      message(error.message, "danger");
      return;
    } finally {
      setBusy(false);
    }
    message(`Thanks for suggesting ${draft.title}. An admin will review it; you can follow it below.`);
    form.reset();
    startOver();
    navigate("/books/suggest#your-suggestions", { replace: true });
  }

  return (
    <Container className="py-5">
      <PageHeader title="Suggest a book">
        Old or new, fiction or not: if it&apos;s published and worth talking about, it belongs here. An admin checks
        each suggestion before it&apos;s added.
      </PageHeader>

      <Row className="justify-content-center">
        <Col lg={7}>
          {/* the book as it will look, filled in as the reader types */}
          <BookCover book={picked ?? preview} size="lg" className="mx-auto mb-4" />
          <Card className="shadow-sm">
            <Card.Body className="p-4">
              {picked ? (
                // one of our books: nothing to suggest
                <div className="text-center">
                  <p className="lead mb-1">
                    <Link to={`/books/${picked.slug}`}>{picked.title}</Link> by {picked.author} is already on OpenRead.
                  </p>
                  <p className="text-body-secondary">You can put it on your bookshelf or a track of your own from its page.</p>
                  <div className="d-flex flex-wrap justify-content-center gap-2">
                    <Button as={Link} to={`/books/${picked.slug}`}>
                      Open the book
                    </Button>
                    <Button variant="outline-secondary" onClick={startOver}>
                      Suggest another book
                    </Button>
                  </div>
                </div>
              ) : (
                <Form noValidate validated={validated} onSubmit={submit}>
                  <fieldset disabled={busy}>
                    <Form.Group className="mb-3" controlId="suggest-title">
                      <Form.Label>Title</Form.Label>
                      <TitleField
                        title={title}
                        setTitle={changeTitle}
                        books={books}
                        mine={mine}
                        isInvalid={validated && Boolean(existing || waiting)}
                        onOurs={setPicked}
                        onWork={fillFrom}
                        onMine={(s) => fillFrom({ ...s, authors: s.author.split(" and ").map((name) => ({ name })) })}
                      />
                      <Form.Control.Feedback type="invalid">
                        {existing ? "We already have this book." : waiting ? "You already suggested it." : "Enter the book's title."}
                      </Form.Control.Feedback>
                      {olWork && (
                        <Form.Text>
                          Filled in from Open Library.
                        </Form.Text>
                      )}
                    </Form.Group>
                    <Row className="g-3 mb-3">
                      <Form.Group as={Col} sm={8} controlId="suggest-author">
                        <Form.Label>{authors.length > 1 ? "Authors" : "Author"}</Form.Label>
                        <AuthorsField authors={authors} setAuthors={setAuthors} people={people} isInvalid={validated && !authors.length} />
                        {validated && !authors.length && <div className="invalid-feedback d-block">Enter who wrote it.</div>}
                      </Form.Group>
                      <Form.Group as={Col} sm={4} controlId="suggest-year">
                        <Form.Label>First published</Form.Label>
                        <Form.Control name="year" type="number" min={-3000} max={THIS_YEAR + 1} placeholder={String(THIS_YEAR)} value={year} onChange={(e) => setYear(e.target.value)} />
                        <Form.Control.Feedback type="invalid">A year up to {THIS_YEAR + 1}; negative for BC.</Form.Control.Feedback>
                      </Form.Group>
                    </Row>

                    {existing && (
                      <p className="small text-danger">
                        <Link to={`/books/${existing.slug}`}>{existing.title}</Link> by {existing.author} is already on OpenRead.
                      </p>
                    )}
                    {!existing && waiting && <p className="small text-danger">You suggested this book already, and it&apos;s waiting for an admin.</p>}

                    <Form.Group className="mb-3" controlId="suggest-url">
                      <Form.Label>Link to more about it</Form.Label>
                      <Form.Control name="url" type="url" maxLength={300} placeholder="https://en.wikipedia.org/wiki/…" />
                      <Form.Text>Its Wikipedia page or the publisher&apos;s, so the admin can check the details.</Form.Text>
                      <Form.Control.Feedback type="invalid">Enter a full link, starting with https://</Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group className="mb-3" controlId="suggest-cover">
                      <Form.Label>Cover image</Form.Label>
                      <Form.Control name="cover" type="url" maxLength={500} placeholder="https://…" value={cover} onChange={(e) => setCover(e.target.value)} />
                      <Form.Text>Optional: a link to a picture of the cover.</Form.Text>
                      <Form.Control.Feedback type="invalid">Enter a full link, starting with https://</Form.Control.Feedback>
                    </Form.Group>
                    <Form.Group className="mb-4" controlId="suggest-note">
                      <Form.Label>Why it belongs here</Form.Label>
                      <Form.Control as="textarea" name="note" rows={3} maxLength={600} placeholder="Optional: what makes it worth reading and talking about together." />
                    </Form.Group>
                    <div className="d-flex flex-wrap gap-2">
                      <BusyButton type="submit" size="lg" busy={busy} busyText="Sending…">
                        Suggest this book
                      </BusyButton>
                      <Button as={Link} to="/books" size="lg" variant="outline-secondary">
                        Cancel
                      </Button>
                    </div>
                  </fieldset>
                </Form>
              )}
            </Card.Body>
          </Card>
        </Col>
      </Row>
      <Note title="What happens next">
        <p className="mb-0">
          An admin checks the details and adds it, usually within a few days. You can follow your suggestion at the
          bottom of this page. Once it&apos;s added, you can put it on a track of your own.
        </p>
      </Note>
      <Suggestions />
    </Container>
  );
}

export default function SuggestBookPage() {
  return (
    <RequireLogin why="Log in to suggest a book.">
      <Suggest />
    </RequireLogin>
  );
}
