import { useState } from "react";
import { Badge, Card, Col, Container, Form, Nav, Row } from "react-bootstrap";
import { Link } from "react-router-dom";

import { RequireLogin } from "../components/Auth.jsx";
import { DifficultyBadge } from "../components/Badges.jsx";
import BookCover from "../components/BookCover.jsx";
import BusyButton from "../components/BusyButton.jsx";
import { IconCircle } from "../components/Icon.jsx";
import { ItemCardPlaceholder, GridPlaceholder, Loader } from "../components/Loading.jsx";
import { useMessage } from "../components/Messages.jsx";
import PageHeader from "../components/PageHeader.jsx";
import { bookBySlug, formatYear, useHeld } from "../data/books.js";
import { DIFFICULTY } from "../data/catalogue.js";
import { formatDate } from "../data/reflections.js";
import { isAdmin, useSuggestions, useUser } from "../store.js";

const TABS = [
  ["pending", "Waiting"],
  ["approved", "Approved"],
  ["rejected", "Rejected"],
];

// one suggestion: the book as it would look, who suggested it and why, and the admin's decision
function Suggestion({ suggestion: s }) {
  const [, , , update] = useSuggestions();
  const message = useMessage();
  // the book on OpenRead it would be again (the API says which) and the one it became, which the site may not hold
  useHeld([s.duplicate, s.book]);
  const [difficulty, setDifficulty] = useState(s.difficulty ?? "challenging");
  const [reason, setReason] = useState("");
  const [deciding, setDeciding] = useState(null); // the status it's being given
  const book = { title: s.title, author: s.author, surname: s.author.split(" ").at(-1), cover: s.cover || null };
  // a book on OpenRead already
  const duplicate = s.duplicate && bookBySlug(s.duplicate);
  // the book it became, once approved
  const added = s.book && bookBySlug(s.book);
  // the decision, then a message saying so, or why it didn't work
  const decide = async (decision, done, tone) => {
    setDeciding(decision.status);
    try {
      await update(s.id, decision);
      message(done, tone);
    } catch (error) {
      message(error.message, "danger");
    }
    setDeciding(null);
  };

  return (
    <Card className="shadow-sm">
      <Card.Body className="d-flex gap-4 p-4">
        <BookCover book={book} size="sm" />
        <div className="flex-grow-1">
          <div className="d-flex flex-wrap justify-content-between gap-2">
            <div>
              <h2 className="h5 mb-0">{s.title}</h2>
              <div className="text-body-secondary">
                {s.author}
                {s.year != null && ` · ${formatYear(s)}`}
              </div>
            </div>
            {s.status === "approved" && <DifficultyBadge level={s.difficulty} />}
          </div>
          <div className="small text-body-secondary mt-2">
            Suggested by {s.name} ({s.email}) on {formatDate(s.createdAt)}
            {s.url && (
              <>
                {" · "}
                <a href={s.url} target="_blank" rel="noopener noreferrer">
                  More about it
                </a>
              </>
            )}
            {s.olWork && (
              <>
                {" · "}
                <a href={`https://openlibrary.org/works/${s.olWork}`} target="_blank" rel="noopener noreferrer">
                  Open Library
                </a>
              </>
            )}
          </div>
          {s.note && <blockquote className="fst-italic mt-2 mb-0">“{s.note}”</blockquote>}
          {duplicate && (
            <p className="small text-danger mt-2 mb-0">
              Looks like <Link to={`/books/${duplicate.slug}`}>{duplicate.title}</Link>, already on OpenRead.
            </p>
          )}

          {s.status === "pending" && (
            <Row className="g-3 mt-1 align-items-end">
              <Form.Group as={Col} md={5} controlId={`difficulty-${s.id}`}>
                <Form.Label className="small">Difficulty</Form.Label>
                <Form.Select size="sm" value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  {Object.entries(DIFFICULTY).map(([key, d]) => (
                    <option key={key} value={key}>
                      {d.label}
                    </option>
                  ))}
                </Form.Select>
              </Form.Group>
              <Col md={7}>
                <BusyButton
                  variant="success"
                  size="sm"
                  disabled={Boolean(duplicate) || deciding !== null}
                  busy={deciding === "approved"}
                  busyText="Adding…"
                  onClick={() => {
                    decide({ status: "approved", difficulty }, `${s.title} is approved and now on OpenRead.`);
                  }}
                >
                  Approve and add
                </BusyButton>
              </Col>
              <Form.Group as={Col} md={9} controlId={`reason-${s.id}`}>
                <Form.Label className="small">Reason, if you reject it</Form.Label>
                <Form.Control
                  size="sm"
                  value={reason}
                  maxLength={300}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder={duplicate ? "Already on OpenRead" : "For example: not published yet"}
                />
              </Form.Group>
              <Col md={3}>
                <BusyButton
                  variant="outline-danger"
                  size="sm"
                  className="w-100"
                  disabled={deciding !== null}
                  busy={deciding === "rejected"}
                  busyText="Rejecting…"
                  onClick={() => {
                    decide({ status: "rejected", reason: reason.trim() || (duplicate ? "Already on OpenRead" : "") }, `${s.title} is rejected.`, "info");
                  }}
                >
                  Reject
                </BusyButton>
              </Col>
            </Row>
          )}
          {s.status === "approved" && (
            <div className="d-flex flex-wrap gap-3 small mt-2">
              {added && <Link to={`/books/${added.slug}`}>See the book</Link>}
              <BusyButton
                variant="link"
                size="sm"
                className="p-0 link-danger"
                busy={deciding === "pending"}
                busyText="Taking it off…"
                onClick={() => {
                  if (!window.confirm(`Take ${s.title} off OpenRead? It comes off readers' lists and tracks too.`)) return;
                  decide({ status: "pending" }, `${s.title} is off the catalogue and waiting for review again.`, "warning");
                }}
              >
                Take it off again
              </BusyButton>
            </div>
          )}
          {s.status === "rejected" && (
            <div className="small mt-2">
              <span className="text-body-secondary">Reason: {s.reason || "none given"} · </span>
              <BusyButton
                variant="link"
                size="sm"
                className="p-0 align-baseline"
                busy={deciding === "pending"}
                busyText="Reconsidering…"
                onClick={() => {
                  decide({ status: "pending" }, `${s.title} is back with the suggestions waiting for review.`, "info");
                }}
              >
                Reconsider
              </BusyButton>
            </div>
          )}
        </div>
      </Card.Body>
    </Card>
  );
}

// The admins' page: the books readers suggested, to approve (they join the catalogue) or reject
function Admin() {
  const user = useUser();
  const [suggestions] = useSuggestions();
  const [tab, setTab] = useState("pending");
  if (!isAdmin(user)) {
    return (
      <Container className="py-5 text-center">
        <PageHeader title="Admins only">This page is for the people who review book suggestions.</PageHeader>
        <Button as={Link} to="/books">
          Back to the books
        </Button>
      </Container>
    );
  }
  const shown = suggestions.filter((s) => s.status === tab);

  return (
    <Container className="py-5">
      <PageHeader title="Book suggestions">
        Books readers asked to add. Approve the ones that are published and not here yet; they join the catalogue at
        once.
      </PageHeader>
      <Row className="justify-content-center">
        <Col lg={9}>
          <Nav variant="pills" activeKey={tab} onSelect={setTab} className="justify-content-center mb-4">
            {TABS.map(([key, label]) => {
              const count = suggestions.filter((s) => s.status === key).length;
              return (
                <Nav.Item key={key}>
                  <Nav.Link eventKey={key} className="d-flex align-items-center gap-2">
                    {label}
                    <Badge pill bg={tab === key ? "light" : "secondary"} text={tab === key ? "primary" : undefined}>
                      {count}
                    </Badge>
                  </Nav.Link>
                </Nav.Item>
              );
            })}
          </Nav>
          {shown.length ? (
            <Loader key={tab} fallback={<GridPlaceholder Item={ItemCardPlaceholder} count={Math.min(shown.length, 3)} xs={1} className="g-3" />}>
              <div className="d-grid gap-3">
                {shown.map((s) => (
                  <Suggestion key={s.id} suggestion={s} />
                ))}
              </div>
            </Loader>
          ) : (
            <div className="text-center py-5">
              <IconCircle name="check-circle-fill" size={72} tone="success" />
              <p className="lead mt-3 mb-0">{tab === "pending" ? "Nothing waiting. All caught up." : `No ${tab} suggestions yet.`}</p>
            </div>
          )}
        </Col>
      </Row>
    </Container>
  );
}

export default function AdminPage() {
  return (
    <RequireLogin why="Log in as an admin to review book suggestions.">
      <Admin />
    </RequireLogin>
  );
}
