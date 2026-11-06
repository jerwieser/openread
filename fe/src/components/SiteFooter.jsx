import { Container } from "react-bootstrap";
import { Link } from "react-router-dom";

import Icon from "./Icon.jsx";
import { FullLogo } from "./Logo.jsx";

const LINK = "link-secondary link-underline-opacity-0 link-underline-opacity-100-hover";

// OpenRead's code, which anyone using the site can get: its licence (the AGPL) asks every running copy
// to offer it. A copy that changes the code links to its own.
const SOURCE = "https://github.com/jerwieser/openread";

// OpenRead's pages elsewhere: placeholders until it has accounts of its own
const SOCIAL = [
  ["https://www.instagram.com/", "instagram", "Instagram"],
  ["https://www.linkedin.com/", "linkedin", "LinkedIn"],
  ["https://x.com/", "twitter-x", "X"],
];

// The footer as one centred column, all in the same small type: the logo and name, what OpenRead is,
// the legal pages and the source code, its social pages as icons, then the copyright, the licences
// and where the covers come from. Links to other sites open in a new tab.
export default function SiteFooter() {
  return (
    <footer className="bg-body border-top small text-body-secondary text-center">
      <Container className="d-flex flex-column align-items-center gap-3 py-5">
        <Link to="/" className="d-inline-flex">
          <FullLogo height={24} />
        </Link>
        <p className="mb-0" style={{ maxWidth: "24rem" }}>
          Reading tracks for whatever you want to know more about, and readers who have read them to talk to.
        </p>
        <ul className="list-unstyled d-flex flex-wrap justify-content-center column-gap-4 row-gap-2 mb-0">
          <li>
            <Link to="/terms" className={LINK}>Terms and conditions</Link>
          </li>
          <li>
            <Link to="/privacy" className={LINK}>Privacy</Link>
          </li>
          <li>
            <a href={SOURCE} className={LINK} target="_blank" rel="noopener noreferrer">
              Source code
            </a>
          </li>
        </ul>
        <ul className="list-unstyled d-flex justify-content-center gap-3 fs-5 mb-0">
          {SOCIAL.map(([href, icon, label]) => (
            <li key={icon}>
              <a href={href} className="link-secondary" target="_blank" rel="noopener noreferrer">
                <Icon name={icon} label={`OpenRead on ${label} (opens in a new tab)`} />
              </a>
            </li>
          ))}
        </ul>
        <div>
          <p className="mb-1">© {new Date().getFullYear()} OpenRead and its contributors</p>
          <p className="mb-1">
            Open source: the code under the{" "}
            <a href="https://www.gnu.org/licenses/agpl-3.0.html" className="link-secondary" target="_blank" rel="noopener noreferrer">
              AGPL
            </a>
            , the books and tracks under{" "}
            <a href="https://creativecommons.org/licenses/by-sa/4.0/" className="link-secondary" target="_blank" rel="noopener noreferrer">
              CC BY-SA
            </a>
          </p>
          <p className="mb-0">
            Covers from{" "}
            <a href="https://commons.wikimedia.org/" className="link-secondary" target="_blank" rel="noopener noreferrer">
              Wikimedia Commons
            </a>{" "}
            and{" "}
            <a href="https://openlibrary.org/" className="link-secondary" target="_blank" rel="noopener noreferrer">
              Open Library
            </a>
          </p>
        </div>
      </Container>
    </footer>
  );
}
