import { useState } from "react";
import { Button, Card, Col, Container, Form, Row } from "react-bootstrap";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";

import { RequireLogin } from "../components/Auth.jsx";
import BookCover from "../components/BookCover.jsx";
import BusyButton from "../components/BusyButton.jsx";
import Icon from "../components/Icon.jsx";
import { LoadingSpinner } from "../components/Loading.jsx";
import { useMessage } from "../components/Messages.jsx";
import PageHeader from "../components/PageHeader.jsx";
import "../components/TrackCard.css";
import { bookBySlug, formatYear, useBookSearch, useHeld } from "../data/books.js";
import { decodeTrack, sharedSlugs, trackById } from "../data/tracks.js";
import { useStatuses, useTracks } from "../store.js";
import NotFoundPage from "./NotFoundPage.jsx";
import OpenLibraryResults from "../components/OpenLibraryResults.jsx";

// where a new track starts: a copy of one of ours (?from=dutch-canon), of a shared one (?shared=…), or
// empty, with a title already filled in when the reader came from a search that found nothing (?title=…)
function startingPoint(params) {
  const source = trackById(params.get("from") ?? "") ?? (params.get("shared") ? decodeTrack(params.get("shared")) : null);
  if (!source) return { title: (params.get("title") ?? "").slice(0, 120), description: "", slugs: [] };
  return { title: source.title, description: source.description ?? "", slugs: source.books.map((s) => s.book.slug), image: source.image };
}

// An uploaded picture, scaled down to at most 960 pixels wide and saved as a JPEG, so a track with
// a picture still fits in the browser's storage. Resolves to a data: URL.
async function shrinkImage(file, maxWidth = 960) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d").drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL("image/jpeg", 0.82);
}

// The picture behind the covers on the track's card: a preview, a button to upload one and one to take it off
function PictureField({ image, onChange }) {
  const [error, setError] = useState("");

  async function upload(e) {
    const file = e.target.files[0];
    e.target.value = ""; // so choosing the same file again still counts as a change
    if (!file) return;
    setError("");
    try {
      onChange(await shrinkImage(file));
    } catch {
      setError("That file couldn't be read as a picture. Try a JPEG or PNG.");
    }
  }

  return (
    <Form.Group className="mb-4" controlId="track-picture">
      <Form.Label>Picture</Form.Label>
      <div
        className="track-picture-preview rounded border mb-2 d-flex align-items-center justify-content-center text-body-secondary small"
        style={image ? { backgroundImage: `url("${image}")` } : undefined}
      >
        {!image && "No picture yet"}
      </div>
      <div className="d-flex flex-wrap align-items-center gap-2">
        {/* free to shrink below the file picker's own width, so it fits a narrow phone */}
        <Form.Control type="file" accept="image/*" onChange={upload} style={{ flex: "1 1 12rem", minWidth: 0 }} />
        {image && (
          <Button variant="outline-secondary" onClick={() => onChange(undefined)}>
            Remove
          </Button>
        )}
      </div>
      {error ? (
        <div className="small text-danger mt-1">{error}</div>
      ) : (
        <Form.Text>Optional. Shown behind the covers on your track&apos;s card; a wide picture works best.</Form.Text>
      )}
    </Form.Group>
  );
}

// one book in a list: its cover, title, author and year, and whatever buttons go with it
function BookRow({ book, number, children }) {
  return (
    <li className="list-group-item d-flex align-items-center gap-3 py-2">
      {number != null && (
        <span className="small fw-semibold text-body-secondary text-end" style={{ width: 20 }}>
          {number}
        </span>
      )}
      <div className="flex-shrink-0" style={{ width: 36 }}>
        <BookCover book={book} size="sm" className="w-100" />
      </div>
      <div className="flex-grow-1 lh-sm">
        <div className="fw-medium">{book.title}</div>
        <div className="small text-body-secondary">
          {book.author}
          {book.year != null && ` · ${formatYear(book)}`}
        </div>
      </div>
      {children}
    </li>
  );
}

function Editor() {
  const [saving, setSaving] = useState(false);
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const message = useMessage();
  const [tracks, add, , update] = useTracks();
  const [statuses] = useStatuses();
  const existing = id ? tracks.find((t) => t.id === id) : null;
  const [start] = useState(() => existing ?? startingPoint(params));
  const [slugs, setSlugs] = useState(start.slugs ?? []);
  const [image, setImage] = useState(start.image);
  const [query, setQuery] = useState("");
  const [validated, setValidated] = useState(false);
  // the track's books, which the site may not hold yet (one shared with the reader), and the search's
  useHeld(slugs);
  const found = useBookSearch(query, 20);
  if (id && !existing) return <NotFoundPage />;

  const books = slugs.map(bookBySlug).filter(Boolean);
  const move = (i, step) =>
    setSlugs((list) => {
      const next = [...list];
      [next[i], next[i + step]] = [next[i + step], next[i]];
      return next;
    });
  const remove = (slug) => setSlugs((list) => list.filter((s) => s !== slug));
  const addBook = (slug) => setSlugs((list) => [...list, slug]);
  const sortByYear = () =>
    setSlugs((list) => [...list].sort((a, b) => (bookBySlug(a).year ?? Infinity) - (bookBySlug(b).year ?? Infinity)));

  const results = found.filter((b) => !slugs.includes(b.slug)).slice(0, 8);
  const fromList = Object.keys(statuses).filter((s) => !slugs.includes(s)).map(bookBySlug).filter(Boolean).slice(0, 6);
  const tooFew = books.length < 2;

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity() || tooFew) {
      setValidated(true);
      return;
    }
    const fields = new FormData(form);
    const track = { title: fields.get("title").trim(), description: fields.get("description").trim(), slugs, image };
    let result;
    setSaving(true);
    try {
      result = existing ? await update(existing.id, track) : await add(track);
    } catch (error) {
      setSaving(false);
      message(error.message, "danger");
      return;
    }
    navigate(`/tracks/${result.id}`);
    message(existing ? "Your track is saved." : "Your track is created. Share it with the link on its page.");
  }

  return (
    <Container className="py-5">
      <PageHeader title={existing ? "Edit your track" : "Create a reading track"}>
        A series of books to read in order, around an idea of your own. You can share it with a link when it&apos;s
        ready.
      </PageHeader>
      <Row className="justify-content-center">
        <Col lg={7}>
          <Form noValidate validated={validated} onSubmit={submit}>
            <fieldset disabled={saving}>
              <Form.Group className="mb-3" controlId="track-title">
                <Form.Label>Title</Form.Label>
                <Form.Control name="title" required maxLength={120} defaultValue={start.title} placeholder="For example: Summer of the Brontës" />
                <Form.Control.Feedback type="invalid">Give your track a title.</Form.Control.Feedback>
              </Form.Group>
              <Form.Group className="mb-4" controlId="track-description">
                <Form.Label>What it&apos;s about</Form.Label>
                <Form.Control as="textarea" name="description" rows={3} maxLength={600} defaultValue={start.description} />
                <Form.Text>Optional. Why these books, and why in this order.</Form.Text>
              </Form.Group>
              <PictureField image={image} onChange={setImage} />

              <div className="d-flex justify-content-between align-items-end mb-2">
                <h2 className="h6 mb-0">Books, in reading order</h2>
                {books.length > 1 && (
                  <Button variant="link" size="sm" className="p-0" onClick={sortByYear}>
                    Sort by year
                  </Button>
                )}
              </div>
              {books.length === 0 ? (
                <p className="text-body-secondary border rounded p-4 text-center mb-0">
                  No books yet. Search for them below, or add them from your bookshelf.
                </p>
              ) : (
                <ol className="list-group">
                  {books.map((b, i) => (
                    <BookRow key={b.slug} book={b} number={i + 1}>
                      <div className="btn-group btn-group-sm">
                        <Button variant="outline-secondary" disabled={i === 0} onClick={() => move(i, -1)} aria-label={`Move ${b.title} up`}>
                          <Icon name="arrow-up" />
                        </Button>
                        <Button variant="outline-secondary" disabled={i === books.length - 1} onClick={() => move(i, 1)} aria-label={`Move ${b.title} down`}>
                          <Icon name="arrow-down" />
                        </Button>
                        <Button variant="outline-secondary" onClick={() => remove(b.slug)} aria-label={`Remove ${b.title}`}>
                          <Icon name="x-lg" />
                        </Button>
                      </div>
                    </BookRow>
                  ))}
                </ol>
              )}
              {validated && tooFew && <div className="small text-danger mt-2">Add at least two books.</div>}

              <Card className="bg-body-tertiary border-0 mt-3">
                <Card.Body className="p-4">
                  <h3 className="h6">Add books</h3>
                  <Form.Control
                    type="search"
                    placeholder="Search by title or author"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && e.preventDefault()}
                    aria-label="Search for books to add"
                    className="mb-3"
                  />
                  {query.trim().length >= 2 && results.length === 0 && (
                    <p className="small text-body-secondary">None of our books match “{query.trim()}”.</p>
                  )}
                  {results.length > 0 && (
                    <ul className="list-group mb-3">
                      {results.map((b) => (
                        <BookRow key={b.slug} book={b}>
                          <Button size="sm" variant="outline-primary" onClick={() => addBook(b.slug)}>
                            Add
                          </Button>
                        </BookRow>
                      ))}
                    </ul>
                  )}
                  {/* any of the world's books, from Open Library, for a track of the reader's own */}
                  <div className="mb-3">
                    <OpenLibraryResults query={query} pickLabel="Add" Heading="h4" onPick={(book) => addBook(book.slug)} />
                  </div>
                  {fromList.length > 0 && (
                    <>
                      <h4 className="small fw-semibold text-body-secondary mt-2">From your bookshelf</h4>
                      <ul className="list-group">
                        {fromList.map((b) => (
                          <BookRow key={b.slug} book={b}>
                            <Button size="sm" variant="outline-primary" onClick={() => addBook(b.slug)}>
                              Add
                            </Button>
                          </BookRow>
                        ))}
                      </ul>
                    </>
                  )}
                </Card.Body>
              </Card>

              <div className="d-flex gap-2 mt-4">
                <BusyButton type="submit" busy={saving} busyText="Saving…">
                  {existing ? "Save changes" : "Save track"}
                </BusyButton>
                <Button as={Link} to={existing ? `/tracks/${existing.id}` : "/discover"} variant="outline-secondary">
                  Cancel
                </Button>
              </div>
            </fieldset>
          </Form>
        </Col>
      </Row>
    </Container>
  );
}

// a copy of a shared track starts from its books, which the site may not hold yet
function HeldEditor() {
  const [params] = useSearchParams();
  const held = useHeld(sharedSlugs(params.get("shared") ?? ""));
  return held ? <Editor /> : <LoadingSpinner />;
}

export default function TrackEditorPage() {
  return (
    <RequireLogin why="Log in to make your own reading tracks and share them.">
      <HeldEditor />
    </RequireLogin>
  );
}
