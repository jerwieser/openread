import { useState } from "react";
import { Col, Container, Form, Row } from "react-bootstrap";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

import { RequireLogin } from "../components/Auth.jsx";
import BookPicker from "../components/BookPicker.jsx";
import BusyButton from "../components/BusyButton.jsx";
import { LoadingSpinner } from "../components/Loading.jsx";
import { useMessage } from "../components/Messages.jsx";
import PageHeader, { Note } from "../components/PageHeader.jsx";
import { bookBySlug, useHeld } from "../data/books.js";
import { useReflections } from "../store.js";
import NotFoundPage from "./NotFoundPage.jsx";

const TIPS = [
  ["Start from a moment", "A scene, a line or the point where you nearly stopped reading."],
  ["Say what changed", "What you thought before, and what you think now you've finished it."],
  ["Bring in the conversation", "What other readers pointed out that you would have missed on your own."],
];

// Writing a new reflection (/reflections/new?book=, from the book's page) or editing one of your own.
// The book comes chosen; it can still be changed by searching (BookPicker), the reader's own books
// first. Saved, a draft or published, it opens on its own page.
function Editor() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const message = useMessage();
  const [own, add, , update] = useReflections();
  const [validated, setValidated] = useState(false);
  const [saving, setSaving] = useState(null); // "draft" or "published", by the button that was pressed
  const existing = id && own.find((r) => r.id === id);
  const [bookSlug, setBookSlug] = useState(() => bookBySlug(existing?.bookSlug ?? params.get("book") ?? "")?.slug ?? "");
  if (id && !existing) return <NotFoundPage />;

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    // the book is a picked one, not a field the browser checks
    if (!form.checkValidity() || !bookSlug) {
      setValidated(true);
      return;
    }
    const fields = new FormData(form);
    const status = e.nativeEvent.submitter?.value === "draft" ? "draft" : "published";
    const reflection = {
      bookSlug,
      title: fields.get("title").trim(),
      text: fields.get("text").trim(),
      status,
    };
    let saved;
    setSaving(status);
    try {
      saved = existing ? await update(existing.id, reflection) : await add(reflection);
    } catch (error) {
      setSaving(null);
      message(error.message, "danger");
      return;
    }
    navigate(`/reflections/${saved.id}`);
    message(status === "published" ? "Your reflection is published." : "Your draft is saved. Only you can see it until you publish it.");
  }

  return (
    <Container className="py-5">
      <PageHeader title={existing ? "Edit your reflection" : "Write a reflection"}>
        An essay on a book you&apos;ve read: what it was like to read, and what stayed with you.
      </PageHeader>
      <Row className="justify-content-center">
        <Col lg={8}>
          <Form noValidate validated={validated} onSubmit={submit}>
            <fieldset disabled={saving !== null}>
              <Form.Group className="mb-3" controlId="reflection-book">
                <Form.Label>Book</Form.Label>
                <BookPicker id="reflection-book" name="book" value={bookSlug} onChange={setBookSlug} isInvalid={validated && !bookSlug} />
                {validated && !bookSlug && <div className="invalid-feedback d-block">Choose the book you&apos;re writing about.</div>}
              </Form.Group>
              <Form.Group className="mb-3" controlId="reflection-title">
                <Form.Label>Title of your reflection</Form.Label>
                <Form.Control name="title" required maxLength={120} defaultValue={existing?.title} placeholder="What you'd call your essay, not the book's title" />
                <Form.Control.Feedback type="invalid">Give your reflection a title.</Form.Control.Feedback>
              </Form.Group>
              <Form.Group className="mb-4" controlId="reflection-text">
                <Form.Label>Your reflection</Form.Label>
                <Form.Control as="textarea" name="text" rows={14} required defaultValue={existing?.text} />
                <Form.Text>Leave a blank line between paragraphs. A few hundred words is plenty.</Form.Text>
                <Form.Control.Feedback type="invalid">Write something before saving.</Form.Control.Feedback>
              </Form.Group>
              <div className="d-flex flex-wrap justify-content-between align-items-center gap-2">
                <span className="small text-body-secondary">A draft is only visible to you.</span>
                <div className="d-flex gap-2">
                  <BusyButton type="submit" name="status" value="draft" variant="outline-secondary" busy={saving === "draft"} busyText="Saving…">
                    Save draft
                  </BusyButton>
                  <BusyButton
                    type="submit"
                    name="status"
                    value="published"
                    busy={saving === "published"}
                    busyText={existing?.status === "published" ? "Updating…" : "Publishing…"}
                  >
                    {existing?.status === "published" ? "Update" : "Publish"}
                  </BusyButton>
                </div>
              </div>
            </fieldset>
          </Form>
        </Col>
      </Row>
      <Note title="What makes a good reflection">
        {TIPS.map(([title, text]) => (
          <p key={title} className="mb-2">
            <b>{title}.</b> {text}
          </p>
        ))}
      </Note>
    </Container>
  );
}

// the book it comes with (?book=), which the site may not hold yet
function HeldEditor() {
  const [params] = useSearchParams();
  const held = useHeld([params.get("book")]);
  return held ? <Editor /> : <LoadingSpinner />;
}

export default function WriteReflectionPage() {
  return (
    <RequireLogin why="Log in to write about a book you've read and share it with other readers.">
      <HeldEditor />
    </RequireLogin>
  );
}
