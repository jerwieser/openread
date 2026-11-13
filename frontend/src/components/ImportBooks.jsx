import { useEffect, useState } from "react";
import { Badge, Button, Col, Collapse, Form, Row, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";

import { SOURCES, matchExport, readExport } from "../data/imports.js";
import { importStatuses, useStatuses } from "../store.js";
import { STATUSES } from "./BookStatus.jsx";
import BusyButton from "./BusyButton.jsx";
import Icon from "./Icon.jsx";
import { useMessage } from "./Messages.jsx";

// Bringing a reader's books over from another reading site, Goodreads or The StoryGraph, in four
// steps: which site; how to get its export and choosing the file; what's in it (which books are on
// OpenRead and get which status, which aren't, and whether to replace statuses the reader already
// has); and what was imported. Used straight after signing up (WelcomeImportPage) and any time later
// (ImportPage), so it ends with the caller's own button.
const ORDER = ["finished", "reading", "paused", "want", "stopped"];

const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// each step's buttons and links in one row, with "Skip for now" last when signing up
function Actions({ onSkip, children }) {
  if (!children && !onSkip) return null;
  return (
    <div className="d-flex flex-wrap align-items-center gap-3 mt-4">
      {children}
      {onSkip && (
        <Button variant="link" className="p-0" onClick={onSkip}>
          Skip for now
        </Button>
      )}
    </div>
  );
}

function ChooseSource({ onChoose, onSkip }) {
  return (
    <>
      <p>Where do you keep track of your reading now?</p>
      {/* one column each, the same width side by side from sm up */}
      <Row xs={1} sm={2} className="g-2">
        {Object.entries(SOURCES).map(([key, { name }]) => (
          <Col key={key}>
            <Button variant="outline-primary" size="lg" className="w-100" onClick={() => onChoose(key)}>
              {name}
            </Button>
          </Col>
        ))}
      </Row>
      <Actions onSkip={onSkip} />
    </>
  );
}

function ChooseFile({ source, onRead, onBack, onSkip }) {
  const { name, site, steps } = SOURCES[source];
  const message = useMessage();
  async function choose(e) {
    // kept before reading the file: React lets go of the event once the handler awaits
    const input = e.currentTarget;
    const file = input.files[0];
    if (!file) return;
    try {
      onRead(readExport(source, await file.text()));
    } catch (error) {
      message(error.message, "danger");
      input.value = "";
    }
  }
  return (
    <>
      <p className="mb-2">
        Get your export from{" "}
        <a href={site} target="_blank" rel="noopener noreferrer">
          {name}
        </a>
        :
      </p>
      <ol className="ps-3">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
      <Form.Group controlId="import-file">
        <Form.Label>Your export from {name}</Form.Label>
        <Form.Control type="file" accept=".csv,text/csv" onChange={choose} />
        <Form.Text>The file stays on your computer: only the books we have on OpenRead are saved.</Form.Text>
      </Form.Group>
      <Actions onSkip={onSkip}>
        <Button variant="link" className="p-0" onClick={onBack}>
          Import from another site
        </Button>
      </Actions>
    </>
  );
}

// a list of book titles that can be opened, for the parts of an export that need a closer look
function MoreList({ label, items, render }) {
  const [open, setOpen] = useState(false);
  if (!items.length) return null;
  return (
    <div className="mt-2">
      <Button variant="link" className="p-0 small" aria-expanded={open} onClick={() => setOpen(!open)}>
        {label} <Icon name={open ? "chevron-up" : "chevron-down"} />
      </Button>
      <Collapse in={open}>
        <ul className="small text-body-secondary mt-2 mb-0">{items.map(render)}</ul>
      </Collapse>
    </div>
  );
}

function Preview({ source, rows, onImport, onBack, onSkip }) {
  const { name } = SOURCES[source];
  const [statuses] = useStatuses();
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  // which of the export's books we have: the API finds them
  const [found, setFound] = useState(null);
  useEffect(() => {
    let current = true;
    matchExport(rows).then(
      (result) => current && setFound(result),
      (error) => current && setFound({ error }),
    );
    return () => {
      current = false;
    };
  }, [rows]);
  if (!found) {
    return (
      <p className="lead d-flex align-items-center gap-2" role="status">
        <Spinner animation="border" size="sm" /> Finding your books on OpenRead…
      </p>
    );
  }
  if (found.error) {
    return (
      <>
        <p className="lead">We couldn&apos;t look your books up just now: {found.error.message}</p>
        <Button variant="link" className="p-0" onClick={onBack}>
          Go back
        </Button>
      </>
    );
  }
  const { matched, unmatched, skipped } = found;
  // books the reader already has a status for, which the import would change
  const differ = matched.filter(({ book, status }) => statuses[book.slug] && statuses[book.slug] !== status);
  const shelves = [...new Set(skipped.map((r) => r.shelf))];

  async function start() {
    setBusy(true);
    try {
      await onImport(matched.map(({ book, status }) => ({ slug: book.slug, status })), replace);
    } finally {
      setBusy(false);
    }
  }

  // greyed out, the choice and the other ways out included, while the books are being imported
  return (
    <fieldset disabled={busy}>
      <p className="lead">
        Your export has {plural(rows.length, "book")}. <b>{matched.length}</b> of them {matched.length === 1 ? "is" : "are"} on
        OpenRead.
      </p>

      {matched.length > 0 && (
        <ul className="list-unstyled d-grid gap-2 mb-3">
          {ORDER.map((s) => {
            const these = matched.filter((m) => m.status === s);
            if (!these.length) return null;
            return (
              <li key={s}>
                <span className="d-flex align-items-center gap-2">
                  <Icon name={STATUSES[s].solid} className="text-primary" />
                  {STATUSES[s].label}
                  <Badge pill bg="secondary">
                    {these.length}
                  </Badge>
                </span>
                <span className="small text-body-secondary">{these.map((m) => m.book.title).join(", ")}</span>
              </li>
            );
          })}
        </ul>
      )}

      {differ.length > 0 && (
        <Form.Check
          id="import-replace"
          className="mb-3"
          checked={replace}
          onChange={(e) => setReplace(e.currentTarget.checked)}
          label={`Use ${name} for the ${plural(differ.length, "book")} you've already marked differently here`}
        />
      )}

      {unmatched.length > 0 && (
        <div className="small text-body-secondary mb-3">
          {plural(unmatched.length, "book")} {unmatched.length === 1 ? "isn't" : "aren't"} on OpenRead yet.{" "}
          <Link to="/books/suggest">Suggest one</Link> and we may add it.
          <MoreList
            label="Show them"
            items={unmatched}
            render={(r, i) => (
              <li key={i}>
                {r.title}, {r.author}
              </li>
            )}
          />
        </div>
      )}
      {skipped.length > 0 && (
        <p className="small text-body-secondary">
          {plural(skipped.length, "book")} on {shelves.length === 1 ? "a shelf" : "shelves"} of your own on {name} (
          {shelves.join(", ")}) {skipped.length === 1 ? "isn't" : "aren't"} imported.
        </p>
      )}

      <Actions onSkip={onSkip}>
        <BusyButton className="py-2 px-4" disabled={!matched.length} onClick={start} busy={busy} busyText="Importing…">
          {matched.length ? `Import ${plural(matched.length, "book")}` : "Nothing to import"}
        </BusyButton>
        <Button variant="link" className="p-0" onClick={onBack}>
          Choose another file
        </Button>
      </Actions>
    </fieldset>
  );
}

// done: what's on the bookshelf now, and the caller's way onward. onSkip: when signing up, a way past
// the whole import from any step but the last.
export default function ImportBooks({ doneLabel, onDone, onSkip }) {
  const [source, setSource] = useState(null);
  const [rows, setRows] = useState(null);
  const [imported, setImported] = useState(null);
  const message = useMessage();

  async function run(books, replace) {
    try {
      await importStatuses(books, replace);
    } catch (error) {
      message(error.message, "danger");
      return;
    }
    setImported(books.length);
    message(`${plural(books.length, "book")} from ${SOURCES[source].name} ${books.length === 1 ? "is" : "are"} on your bookshelf.`);
  }

  if (imported != null) {
    return (
      <>
        <p className="lead">
          <Icon name="check-circle-fill" className="text-success me-2" />
          Your books from {SOURCES[source].name} are on your bookshelf.
        </p>
        <p className="text-body-secondary">
          You can import again any time from <Link to="/account#import">Settings</Link>, for example after reading more on{" "}
          {SOURCES[source].name}.
        </p>
        <Button className="py-2 px-4" onClick={onDone}>
          {doneLabel}
        </Button>
      </>
    );
  }
  if (rows) return <Preview source={source} rows={rows} onImport={run} onBack={() => setRows(null)} onSkip={onSkip} />;
  if (source) return <ChooseFile source={source} onRead={setRows} onBack={() => setSource(null)} onSkip={onSkip} />;
  return <ChooseSource onChoose={setSource} onSkip={onSkip} />;
}
