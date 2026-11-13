import { useEffect, useState } from "react";
import { Accordion, Button, Col, Container, Form, Row } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { RequireLogin } from "../components/Auth.jsx";
import BusyButton from "../components/BusyButton.jsx";
import Icon from "../components/Icon.jsx";
import { useMessage } from "../components/Messages.jsx";
import PageHeader from "../components/PageHeader.jsx";
import ProfileFields, { profileFrom } from "../components/ProfileFields.jsx";
import { READING_LANGUAGES, SITE_LANGUAGES, languageName } from "../data/languages.js";
import { changeEmail, deleteAccount, forgotPassword, logOut, updateAccount, useUser } from "../store.js";

// One section of the settings: a row of Bootstrap's accordion, its header the section's icon, name
// and a line saying what's in it, so the closed page reads as an overview
function Section({ id, icon, title, summary, children }) {
  return (
    <Accordion.Item eventKey={id} id={id}>
      <Accordion.Header>
        <span className="d-flex align-items-center gap-3">
          <Icon name={icon} size="1.25rem" className="text-primary flex-shrink-0" />
          <span>
            <span className="d-block fw-semibold">{title}</span>
            <span className="d-block small text-body-secondary">{summary}</span>
          </span>
        </span>
      </Accordion.Header>
      <Accordion.Body className="p-4">{children}</Accordion.Body>
    </Accordion.Item>
  );
}

// a form that says so in a message at the top of the page once it's saved
function SettingsForm({ onSave, done, button = "Save changes", busyText = "Saving…", children }) {
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);
  const message = useMessage();
  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      setValidated(true);
      return;
    }
    setBusy(true);
    try {
      await onSave(new FormData(form), form);
    } catch (error) {
      setBusy(false);
      message(error.message, "danger");
      return;
    }
    setBusy(false);
    setValidated(false);
    message(done);
  }
  return (
    <Form noValidate validated={validated} onSubmit={submit}>
      <fieldset disabled={busy}>
        {children}
        <BusyButton type="submit" busy={busy} busyText={busyText}>
          {button}
        </BusyButton>
      </fieldset>
    </Form>
  );
}

const named = (code) => languageName(code) ?? code;

// the browser's languages, by their main language: what counts while a reader has chosen none
const browserLanguages = () => [...new Set((navigator.languages ?? [navigator.language]).map((c) => c.split("-")[0]))];

function languagesSummary(user) {
  const reading = user.readingLanguages?.length ? user.readingLanguages.map(named).join(", ") : "your browser's languages";
  return `Site in ${named(user.siteLanguage ?? "en")}, books in ${reading}`;
}

// The site's language, and the languages the reader reads in, the most wanted first: the titles,
// covers and authors' names they see. Learning a language? Put it first. With none chosen, the
// browser's count.
function LanguagesForm({ user }) {
  const [reading, setReading] = useState(user.readingLanguages ?? []);
  const move = (i) => setReading((codes) => [...codes.slice(0, i - 1), codes[i], codes[i - 1], ...codes.slice(i + 1)]);
  const choosable = READING_LANGUAGES.filter((code) => !reading.includes(code));
  return (
    <SettingsForm
      onSave={(f) => updateAccount({ siteLanguage: f.get("siteLanguage"), readingLanguages: reading })}
      done="Your languages are saved."
      button="Save languages"
    >
      <Form.Group className="mb-4" controlId="account-site-language">
        <Form.Label>Site language</Form.Label>
        <Form.Select name="siteLanguage" defaultValue={user.siteLanguage ?? "en"} className="w-auto">
          {SITE_LANGUAGES.map((code) => (
            <option key={code} value={code}>
              {named(code)}
            </option>
          ))}
        </Form.Select>
        <Form.Text>OpenRead is in English for now; more languages will follow.</Form.Text>
      </Form.Group>

      <Form.Group className="mb-4" controlId="account-reading-language">
        <Form.Label>Reading languages</Form.Label>
        <p className="small text-body-secondary mb-2">
          Books show their titles and covers in the first of these they have, the most wanted first. Learning a
          language? Put it at the top.
        </p>
        {reading.length ? (
          <ol className="list-group list-group-numbered mb-2">
            {reading.map((code, i) => (
              <li key={code} className="list-group-item d-flex align-items-center gap-2">
                <span className="me-auto">{named(code)}</span>
                <Button variant="link" size="sm" className="p-1" disabled={i === 0} onClick={() => move(i)}>
                  <Icon name="arrow-up" label={`Move ${named(code)} up`} />
                </Button>
                <Button
                  variant="link"
                  size="sm"
                  className="p-1 link-secondary"
                  onClick={() => setReading((codes) => codes.filter((c) => c !== code))}
                >
                  <Icon name="x-lg" label={`Remove ${named(code)}`} />
                </Button>
              </li>
            ))}
          </ol>
        ) : (
          <p className="small mb-2">
            None chosen, so your browser&apos;s are used: {browserLanguages().map(named).join(", ")}.
          </p>
        )}
        {reading.length < 10 && (
          <Form.Select
            className="w-auto"
            value=""
            onChange={(e) => e.target.value && setReading((codes) => [...codes, e.target.value])}
          >
            <option value="">Add a language…</option>
            {choosable.map((code) => (
              <option key={code} value={code}>
                {named(code)}
              </option>
            ))}
          </Form.Select>
        )}
      </Form.Group>
    </SettingsForm>
  );
}

// The settings as an accordion, the most used first: the profile, bringing books over from
// Goodreads or The StoryGraph, the email address and password, the site's and the books' languages,
// and logging out or deleting the account. Each section
// opens and closes on its own, and "Expand all" (or, with all of them open, "Collapse all") does
// them all at once. Each has its own address (/account#import), so a link can open it; while just
// one is open, the address bar has it.
const SECTIONS = ["profile", "import", "login", "languages", "account"];
// the addresses the email and password had when they were sections of their own
const MOVED = { email: "login", password: "login" };

function Account() {
  const user = useUser();
  const navigate = useNavigate();
  const message = useMessage();
  const [deleting, setDeleting] = useState(false);
  const { hash } = useLocation();
  const asked = MOVED[hash.slice(1)] ?? hash.slice(1);
  const [open, setOpen] = useState(SECTIONS.includes(asked) ? [asked] : []);
  // a link to a section while the page is already open, like the import's "Settings"
  useEffect(() => {
    if (SECTIONS.includes(asked)) setOpen((keys) => (keys.includes(asked) ? keys : [...keys, asked]));
  }, [asked]);
  // the one open section in the address, without the router noticing, which would scroll the page
  const show = (keys) => {
    setOpen(keys);
    window.history.replaceState(window.history.state, "", keys.length === 1 ? `#${keys[0]}` : window.location.pathname);
  };

  return (
    <Container className="py-5">
      <PageHeader title="Settings">Your profile, your books from other sites, how you log in, your languages and your account.</PageHeader>
      <Row className="justify-content-center">
        <Col lg={8}>
          {/* one link: "Collapse all" once every section is open, "Expand all" until then, each with the
              double chevron that goes with the accordion's own */}
          <div className="d-flex justify-content-end small mb-2">
            {open.length === SECTIONS.length ? (
              <Button variant="link" className="icon-link p-0 small" onClick={() => show([])}>
                <Icon name="chevron-contract" />
                Collapse all
              </Button>
            ) : (
              <Button variant="link" className="icon-link p-0 small" onClick={() => show(SECTIONS)}>
                <Icon name="chevron-expand" />
                Expand all
              </Button>
            )}
          </div>
          <Accordion alwaysOpen activeKey={open} onSelect={(keys) => show(keys ?? [])} className="shadow-sm">
            <Section id="profile" icon="person-circle" title="Profile" summary="What other readers see when you ask them about a book">
              <p className="small text-body-secondary">
                Shown on <Link to={`/readers/${user.id}`}>your profile</Link>.
              </p>
              <SettingsForm onSave={(f) => updateAccount(profileFrom(f))} done="Your profile is saved." button="Save profile">
                <ProfileFields user={user} />
              </SettingsForm>
            </Section>

            <Section id="import" icon="box-arrow-in-down" title="Import your books" summary="From Goodreads or The StoryGraph, onto your bookshelf">
              <p>
                The books you&apos;ve read, are reading and want to read on Goodreads or The StoryGraph go straight onto your
                bookshelf. Do it
                again whenever you like; books you&apos;ve marked here keep their place unless you say otherwise.
              </p>
              <Button as={Link} to="/import" variant="outline-primary">
                Import your books
              </Button>
            </Section>

            <Section id="login" icon="key" title="Email and password" summary={`What you log in with: ${user.email}`}>
              <SettingsForm
                onSave={async (f, form) => {
                  await changeEmail(f.get("email").trim());
                  form.reset();
                }}
                done="We've sent a link to your new address. Your email changes once you open it."
                button="Change email"
                busyText="Sending…"
              >
                <Row className="g-3 mb-4">
                  <Form.Group as={Col} sm={6} controlId="account-email">
                    <Form.Label>New email address</Form.Label>
                    <Form.Control name="email" type="email" required autoComplete="email" />
                    <Form.Control.Feedback type="invalid">Enter a valid email address.</Form.Control.Feedback>
                  </Form.Group>
                </Row>
              </SettingsForm>
              <hr className="my-4" />
              <SettingsForm
                onSave={() => forgotPassword(user.email)}
                done={`We've sent a link to ${user.email}. Open it to choose a new password.`}
                button="Change password"
                busyText="Sending…"
              >
                <p>We&apos;ll email you a link to choose a new password.</p>
              </SettingsForm>
            </Section>

            <Section id="languages" icon="translate" title="Languages" summary={languagesSummary(user)}>
              <LanguagesForm user={user} />
            </Section>

            <Section id="account" icon="box-arrow-right" title="Your account" summary="Log out, or delete your account">
              <p>Logging out keeps everything as it is for next time. Deleting your account removes it and all you&apos;ve written, for good.</p>
              <div className="d-flex flex-wrap justify-content-between gap-2">
                <Button
                  variant="outline-secondary"
                  onClick={async () => {
                    if (!window.confirm("Log out of OpenRead?")) return;
                    await logOut();
                    navigate("/");
                    message("You're logged out. See you soon.", "info");
                  }}
                >
                  Log out
                </Button>
                <BusyButton
                  variant="outline-danger"
                  busy={deleting}
                  busyText="Deleting…"
                  onClick={async () => {
                    if (!window.confirm("Delete your account? You'll be logged out and it can't be undone.")) return;
                    setDeleting(true);
                    try {
                      await deleteAccount();
                    } catch (error) {
                      setDeleting(false);
                      message(error.message, "danger");
                      return;
                    }
                    navigate("/");
                    message("Your account is deleted.", "info");
                  }}
                >
                  Delete account
                </BusyButton>
              </div>
            </Section>
          </Accordion>
        </Col>
      </Row>
    </Container>
  );
}

export default function AccountPage() {
  return (
    <RequireLogin why="Log in to change your profile and your password.">
      <Account />
    </RequireLogin>
  );
}
