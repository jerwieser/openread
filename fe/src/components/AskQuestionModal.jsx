// The "Ask a question" dialog itself, loaded the first time someone opens it (see AskQuestion.jsx).
// The question is the first message of a conversation with the reader, so the reply comes in under
// Messages; asking takes an account.
import { useState } from "react";
import { Button, Form, Modal } from "react-bootstrap";
import { Link, useLocation } from "react-router-dom";

import { sendMessage } from "../data/inbox.js";
import { firstName } from "../data/readers.js";
import { useUser } from "../store.js";
import BusyButton from "./BusyButton.jsx";
import Initials from "./Initials.jsx";
import { useMessage } from "./Messages.jsx";
import { modalManager } from "./modalManager.js";

export default function AskQuestionModal({ prefill: { reader, book }, onClose }) {
  const user = useUser();
  const { pathname, search } = useLocation();
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);
  const message = useMessage();

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      setValidated(true);
      form.querySelector("input:invalid, select:invalid, textarea:invalid")?.focus();
      return;
    }
    const fields = Object.fromEntries(new FormData(form));
    setBusy(true);
    try {
      await sendMessage(reader, fields.question.trim());
    } catch (error) {
      setBusy(false);
      message(error.message, "danger");
      return;
    }
    onClose();
    message(
      <>
        Your question is sent. You&apos;ll find {firstName(reader)}&apos;s reply in{" "}
        <Link to={`/messages/${reader.id}`} className="alert-link">
          your messages
        </Link>
        .
      </>,
    );
  }

  return (
    <Modal show onHide={onClose} centered scrollable manager={modalManager}>
      <Modal.Header closeButton>
        <Modal.Title as="h2" className="h5 d-flex align-items-center gap-2">
          <Initials name={reader.name} photo={reader.photo} size={32} />
          Ask {firstName(reader)} a question
        </Modal.Title>
      </Modal.Header>

      {user ? (
        <>
          {/* the footer's button submits the form by id, so the body can still scroll */}
          <Modal.Body>
            <Form id="ask-question-form" noValidate validated={validated} onSubmit={submit}>
              <fieldset disabled={busy}>
                <p className="text-body-secondary">
                  Stuck on a passage, or wondering what to read next? Readers who know a book are happy to help. Keep it
                  short and specific; the reply comes in under Messages.
                </p>
                <Form.Group controlId="ask-question">
                  <Form.Label>Your question</Form.Label>
                  <Form.Control
                    as="textarea"
                    name="question"
                    rows={4}
                    required
                    maxLength={800}
                    // asked from a book's page, the question starts by naming the book, as part of the text
                    defaultValue={book ? `About ${book.title}: ` : ""}
                    placeholder="For example: why does the narrator keep interrupting the story here?"
                  />
                  <Form.Control.Feedback type="invalid">Write your question.</Form.Control.Feedback>
                </Form.Group>
              </fieldset>
            </Form>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="outline-secondary" disabled={busy} onClick={onClose}>
              Cancel
            </Button>
            <BusyButton type="submit" form="ask-question-form" busy={busy} busyText="Sending…">
              Send question
            </BusyButton>
          </Modal.Footer>
        </>
      ) : (
        <>
          <Modal.Body>
            <p className="mb-0">
              Log in to ask {firstName(reader)} a question. Questions and replies are kept under Messages in your
              account, so you can carry on the conversation.
            </p>
          </Modal.Body>
          <Modal.Footer>
            <Button as={Link} to={`/sign-up?next=${encodeURIComponent(pathname + search)}`} variant="outline-secondary" onClick={onClose}>
              Sign up
            </Button>
            <Button as={Link} to={`/log-in?next=${encodeURIComponent(pathname + search)}`} onClick={onClose}>
              Log in
            </Button>
          </Modal.Footer>
        </>
      )}
    </Modal>
  );
}
