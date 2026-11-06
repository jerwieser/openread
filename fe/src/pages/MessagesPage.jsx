import { useEffect, useRef, useState } from "react";
import { Container, Form } from "react-bootstrap";
import { Link, useParams } from "react-router-dom";

import { RequireLogin } from "../components/Auth.jsx";
import BusyButton from "../components/BusyButton.jsx";
import ConversationList from "../components/Conversations.jsx";
import { IconCircle } from "../components/Icon.jsx";
import Initials from "../components/Initials.jsx";
import { ListPlaceholder, Loader } from "../components/Loading.jsx";
import { useMessage } from "../components/Messages.jsx";
import PageHeader, { usePageTitle } from "../components/PageHeader.jsx";
import { OPENREAD, correspondent, sendMessage, sentAt, useConversations } from "../data/inbox.js";
import { aboutLine, firstName } from "../data/readers.js";
import { markRead, useUser } from "../store.js";
import NotFoundPage from "./NotFoundPage.jsx";

const COLUMN = { maxWidth: "40rem" };

// /messages: every conversation, newest first
function Inbox() {
  const user = useUser();
  const { conversations, unread } = useConversations();
  return (
    <Container className="py-5">
      <PageHeader title="Messages">
        {unread ? `${unread} new. ` : ""}Questions you asked other readers, and what they asked you.
      </PageHeader>
      <div className="mx-auto" style={COLUMN}>
        {conversations.length ? (
          <Loader fallback={<ListPlaceholder rows={Math.min(conversations.length, 4)} />}>
            <ConversationList conversations={conversations} userId={user.id} />
          </Loader>
        ) : (
          <div className="text-center">
            <IconCircle name="chat-quote" size={72} />
            <p className="lead mt-3">No messages yet.</p>
            <p className="text-body-secondary">
              Stuck in a book? Ask someone who has read it: there&apos;s a button on every reader&apos;s profile and on
              each book&apos;s page.
            </p>
          </div>
        )}
      </div>
    </Container>
  );
}

// one message: the reader's own on the right in blue, the other's on the left in grey, and when it
// was sent
function Bubble({ message: m, mine }) {
  return (
    <div className={`d-flex mb-3 ${mine ? "justify-content-end" : ""}`}>
      <div style={{ maxWidth: "85%" }}>
        <div className={`px-3 py-2 rounded-4 ${mine ? "text-bg-primary" : "bg-body-tertiary border"}`} style={{ whiteSpace: "pre-wrap" }}>
          {m.text}
        </div>
        <div className={`small text-body-secondary mt-1 ${mine ? "text-end" : ""}`}>{sentAt(m.createdAt)}</div>
      </div>
    </div>
  );
}

// /messages/:id: the conversation with one reader, read from the top, with a reply box under it
// (OpenRead's messages can't be answered). Opening it marks their messages as read.
function Conversation({ id }) {
  const user = useUser();
  const { conversations } = useConversations();
  const reader = correspondent(id);
  const conversation = conversations.find((c) => c.id === id);
  const messages = conversation?.messages ?? [];
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const end = useRef(null);
  const message = useMessage();

  useEffect(() => {
    if (conversation?.unread) markRead(id);
  }, [conversation?.unread, id]);

  // the newest message in view, after each new one
  useEffect(() => {
    if (messages.length) end.current?.scrollIntoView({ block: "nearest" });
  }, [messages.length]);

  usePageTitle(reader && reader.id !== user.id ? `Messages with ${reader.name}` : null);
  if (!reader) return <NotFoundPage />;
  if (reader.id === user.id) return <NotFoundPage />;

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    try {
      await sendMessage(reader, text.trim());
    } catch (error) {
      message(error.message, "danger");
      return;
    } finally {
      setSending(false);
    }
    setText("");
  }

  return (
    <Container className="py-5">
      <header className="text-center mb-5">
        <div className="d-flex justify-content-center mb-3">
          <Initials name={reader.name} photo={reader.photo} size={72} />
        </div>
        <h1 className="display-6 fw-bold text-body-emphasis mb-1">
          {reader === OPENREAD ? (
            reader.name
          ) : (
            <Link to={`/readers/${reader.id}`} className="link-body-emphasis text-decoration-none">
              {reader.name}
            </Link>
          )}
        </h1>
        <p className="text-body-secondary mb-2">{aboutLine(reader)}</p>
        <Link to="/messages" className="small link-secondary">
          All messages
        </Link>
      </header>

      <div className="mx-auto" style={COLUMN}>
        {messages.length ? (
          messages.map((m) => <Bubble key={m.id} message={m} mine={m.from === user.id} />)
        ) : (
          <p className="text-center text-body-secondary">No messages yet. Say hello, or ask about a book {firstName(reader)} has read.</p>
        )}
        {reader === OPENREAD ? (
          <p className="small text-body-secondary text-center mt-4 mb-0" ref={end}>
            You can&apos;t reply to messages from OpenRead.
          </p>
        ) : (
          <Form onSubmit={send} className="mt-4" ref={end}>
            <Form.Control
              as="textarea"
              rows={3}
              value={text}
              readOnly={sending}
              onChange={(e) => setText(e.target.value)}
              maxLength={800}
              placeholder={`Write to ${firstName(reader)}…`}
              aria-label={`Message to ${reader.name}`}
            />
            <div className="d-flex justify-content-end mt-2">
              <BusyButton type="submit" disabled={!text.trim()} busy={sending} busyText="Sending…">
                Send
              </BusyButton>
            </div>
          </Form>
        )}
      </div>
    </Container>
  );
}

export default function MessagesPage() {
  const { id } = useParams();
  return <RequireLogin why="Log in to read and send messages.">{id ? <Conversation id={id} /> : <Inbox />}</RequireLogin>;
}
