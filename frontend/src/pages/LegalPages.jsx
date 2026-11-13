import { Alert, Col, Container, Row } from "react-bootstrap";
import { Link } from "react-router-dom";

import Icon from "../components/Icon.jsx";
import PageHeader from "../components/PageHeader.jsx";

const UPDATED = "23 October 2026";

// The terms and the privacy statement share a layout: the centred page header, a note that these are
// drafts for the prototype, then the sections in one readable column
function LegalPage({ title, intro, sections }) {
  return (
    <Container className="py-5">
      <PageHeader title={title}>{intro}</PageHeader>
      <Row className="justify-content-center">
        <Col lg={8}>
          <Alert variant="light" className="border small mb-5">
            <Icon name="info-circle" className="me-1" />
            OpenRead is a prototype and this is a draft, not a final legal text. Last updated {UPDATED}.
          </Alert>
          {sections.map(([heading, body]) => (
            <section key={heading} className="mb-5">
              <h2 className="h4 fw-bold text-body-emphasis mb-3">{heading}</h2>
              {body}
            </section>
          ))}
        </Col>
      </Row>
    </Container>
  );
}

export function TermsPage() {
  return (
    <LegalPage
      title="Terms and conditions"
      intro="The agreement between you and OpenRead when you use the site, in plain language."
      sections={[
        [
          "Using OpenRead",
          <>
            <p>
              OpenRead helps you find books about what interests you and talk about them with other readers: you can follow
              reading tracks, keep track of the books you want to read, are reading and have finished, ask other readers questions and write reflections. By using the site you agree
              to these terms.
            </p>
            <p className="mb-0">You need to be at least 16 to create an account, or have permission from a parent or guardian.</p>
          </>,
        ],
        [
          "Your account",
          <p className="mb-0">
            Keep your password to yourself and tell us if you think someone else has used your account. You can delete
            your account at any time from <Link to="/account">Settings</Link>.
          </p>,
        ],
        [
          "What you write",
          <>
            <p>
              Your reflections and the tracks you make are yours. When you publish a reflection or share a track, you
              let OpenRead show it on the site and let others read it.
            </p>
            <p className="mb-0">
              Don&apos;t post anything that is unlawful, hateful or someone else&apos;s work without permission. We may
              remove posts that break these rules.
            </p>
          </>,
        ],
        [
          "Messages",
          <>
            <p className="mb-0">
              Readers are independent people who volunteer their time. OpenRead puts you in touch, but isn&apos;t
              responsible for what is said or agreed between you. Be kind, and let us know if something goes wrong.
            </p>
          </>,
        ],
        [
          "Books and covers",
          <p className="mb-0">
            The covers come from Wikimedia Commons and Open Library and are shown to help you recognise each book. The books themselves belong to
            their authors, translators and publishers.
          </p>,
        ],
        [
          "Changes and contact",
          <p className="mb-0">
            We may update these terms as OpenRead grows, and will say so on this page. Questions? See the{" "}
            <Link to="/privacy">privacy statement</Link> for how we handle your details.
          </p>,
        ],
      ]}
    />
  );
}

export function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy"
      intro="What OpenRead knows about you, where it's kept and what you can do about it."
      sections={[
        [
          "What we keep",
          <>
            <p>When you use OpenRead we keep:</p>
            <ul className="mb-0">
              <li>your name and email address, if you create an account;</li>
              <li>the books on your bookshelf, where you are with each, and the tracks you make;</li>
              <li>the messages you send and the reflections you write.</li>
            </ul>
          </>,
        ],
        [
          "Where it's kept",
          <p className="mb-0">
            On OpenRead&apos;s own server. Your password is stored only as a secure hash, never as you typed
            it. Deleting your account under Settings removes your profile and everything you added.
          </p>,
        ],
        [
          "Cookies and tracking",
          <p className="mb-0">
            OpenRead doesn&apos;t use advertising or tracking cookies, and doesn&apos;t sell or share your details. The
            site loads one font from Google Fonts, which sees your IP address like any website you visit.
          </p>,
        ],
        [
          "Your choices",
          <p className="mb-0">
            You can change your details or delete your account, with everything in it, from{" "}
            <Link to="/account">Settings</Link>. Links to other sites, such as Instagram, follow
            those sites&apos; own privacy policies.
          </p>,
        ],
        [
          "Changes",
          <p className="mb-0">
            When OpenRead starts keeping data on a server, we&apos;ll update this page first. See also the{" "}
            <Link to="/terms">terms and conditions</Link>.
          </p>,
        ],
      ]}
    />
  );
}
