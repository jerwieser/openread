import { Fragment, useEffect, useRef } from "react";
import { Badge, Container, Dropdown, Nav, Navbar, Spinner } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useConversations } from "../data/inbox.js";
import { isAdmin, logOut, useCatalogue, useSuggestions, useUser } from "../store.js";
import Icon from "./Icon.jsx";
import Initials from "./Initials.jsx";
import { useMessage } from "./Messages.jsx";
import { FullLogo } from "./Logo.jsx";

// each page in the menu, with its icon and the paths that count as being on it: Discover, which
// covers the tracks and the books it leads to, then the reader's own Bookshelf, last so it sits
// next to their avatar
const PAGES = [
  ["/discover", "Discover", "compass", ["/tracks", "/books"]],
  ["/bookshelf", "Bookshelf", "bookmarks", []],
];

const isPage = (pathname, to, also) => [to, ...also].some((p) => pathname === p || pathname.startsWith(`${p}/`));

// Bootstrap's notification dot on the corner of the avatar or the burger button: there are new
// messages (getbootstrap.com/docs/5.3/components/badge/#positioned)
const Dot = () => <span className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-2 border-light rounded-circle" />;

const Unread = ({ count }) =>
  count > 0 && (
    <Badge pill bg="danger">
      {count}
      <span className="visually-hidden"> new</span>
    </Badge>
  );

// The account links, in groups, the same in the avatar's dropdown and the burger menu: logged out,
// logging in and signing up; logged in, the reader's own pages, what they can start and logging out.
// None while the site opens: who's logged in isn't known yet, and the avatar shows a spinner instead.
function useAccountLinks() {
  const user = useUser();
  const opening = useCatalogue() === "loading";
  const navigate = useNavigate();
  const message = useMessage();
  const [suggestions] = useSuggestions();
  const { unread } = useConversations();
  const waiting = suggestions.filter((s) => s.status === "pending").length;

  if (opening) return { opening, user: null, unread: 0, groups: [] };
  if (!user) return { user, unread, groups: [[{ to: "/log-in", label: "Log in" }, { to: "/sign-up", label: "Sign up" }]] };
  // asks first, with the browser's own confirm dialog like the site's other second thoughts
  const logOutNow = async () => {
    if (!window.confirm("Log out of OpenRead?")) return;
    await logOut();
    navigate("/");
    message("You're logged out. See you soon.", "info");
  };
  return {
    user,
    unread,
    groups: [
      [
        { to: "/messages", label: "Messages", count: unread },
        { to: `/readers/${user.id}`, label: "Profile" },
        { to: "/account", label: "Settings" },
      ],
      [
        { to: "/tracks/new", label: "Create a track" },
        { to: "/books/suggest", label: "Suggest a book" },
        isAdmin(user) && { to: "/admin", label: "Review suggestions", count: waiting },
      ].filter(Boolean),
      [{ label: "Log out", onClick: logOutNow }],
    ],
  };
}

const isOn = (pathname, to) => pathname === to || (to === "/messages" && pathname.startsWith("/messages/"));

// From lg up: Bootstrap's avatar dropdown from its header examples
// (getbootstrap.com/docs/5.3/examples/headers), laid out like the page links next to it: the avatar,
// as on the reader's profile, or a person icon when logged out, the size of their icons, with
// "Account" under it and the dropdown's caret after that word, like LinkedIn's "Me". Bootstrap draws
// the caret after the button itself, which would put it under the word, so the button's is hidden
// (layout.css) and the word gets Bootstrap's dropdown-toggle class, and with it the same caret. In
// the colour of the other nav links, their hover and their pressed colour included (Bootstrap's
// navbar variables, given to the button's own).
const NAV_LINK_COLOURS = {
  "--bs-btn-color": "var(--bs-navbar-color)",
  "--bs-btn-hover-color": "var(--bs-navbar-hover-color)",
  "--bs-btn-active-color": "var(--bs-navbar-active-color)",
  // disabled while the site opens (its spinner showing), without fading
  "--bs-btn-disabled-color": "var(--bs-navbar-color)",
  "--bs-btn-disabled-opacity": 1,
};

// the spinner while the site opens, as big as the avatar it stands in for, like the pages' own
// (Loading.jsx)
const ACCOUNT_SPINNER = { width: 24, height: 24, borderWidth: 3 };

function AccountDropdown() {
  const { pathname } = useLocation();
  const { opening, user, unread, groups } = useAccountLinks();
  return (
    <Dropdown align="end">
      <Dropdown.Toggle
        variant="link"
        id="account-menu"
        disabled={opening}
        aria-busy={opening}
        className="navbar-account navbar-item d-flex flex-column align-items-center p-0 border-0 text-decoration-none"
        style={NAV_LINK_COLOURS}
      >
        <span className="position-relative d-inline-flex">
          {opening ? (
            <Spinner animation="border" variant="primary" role="status" style={ACCOUNT_SPINNER}>
              <span className="visually-hidden">Loading your account…</span>
            </Spinner>
          ) : user ? (
            <Initials name={user.name} photo={user.photo} size={24} />
          ) : (
            <Icon name="person-circle" size={24} />
          )}
          {unread > 0 && <Dot />}
        </span>
        <span className="nav-link-label dropdown-toggle mt-1" aria-hidden="true">
          Account
        </span>
        <span className="visually-hidden">
          Account menu{unread > 0 && `, ${unread} new ${unread === 1 ? "message" : "messages"}`}
        </span>
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {user && (
          <Dropdown.Header>
            <div className="fw-semibold text-body-emphasis">{user.name}</div>
            {user.email}
          </Dropdown.Header>
        )}
        {groups.map((group, i) => (
          <Fragment key={i}>
            {i > 0 && <Dropdown.Divider />}
            {group.map((l) =>
              l.to ? (
                <Dropdown.Item key={l.label} as={Link} to={l.to} active={isOn(pathname, l.to)} className="d-flex justify-content-between align-items-center gap-3">
                  {l.label}
                  <Unread count={l.count} />
                </Dropdown.Item>
              ) : (
                <Dropdown.Item key={l.label} as="button" onClick={l.onClick}>
                  {l.label}
                </Dropdown.Item>
              ),
            )}
          </Fragment>
        ))}
      </Dropdown.Menu>
    </Dropdown>
  );
}

// Below lg: the same links as plain nav links at the bottom of the burger menu, under a line
function AccountNav() {
  const { pathname } = useLocation();
  const { opening, groups } = useAccountLinks();
  return (
    <Nav className="border-top mt-2 pt-2">
      {opening && (
        <div className="py-2">
          <Spinner animation="border" variant="primary" size="sm" role="status">
            <span className="visually-hidden">Loading your account…</span>
          </Spinner>
        </div>
      )}
      {groups.map((group, i) => (
        <Fragment key={i}>
          {i > 0 && <hr className="my-2" />}
          {group.map((l) =>
            l.to ? (
              <Nav.Link key={l.label} as={Link} to={l.to} eventKey={l.to} active={isOn(pathname, l.to)} className="d-flex align-items-center gap-2">
                {l.label}
                <Unread count={l.count} />
              </Nav.Link>
            ) : (
              <Nav.Link key={l.label} as="button" eventKey="log-out" onClick={l.onClick} className="text-start">
                {l.label}
              </Nav.Link>
            ),
          )}
        </Fragment>
      ))}
    </Nav>
  );
}

// A message when a new one comes in while the reader is here (not for the ones already waiting,
// and not on the messages pages themselves)
function useNewMessageAlert() {
  const { pathname } = useLocation();
  const message = useMessage();
  const { unread } = useConversations();
  const seen = useRef(unread);
  useEffect(() => {
    if (unread > seen.current && !pathname.startsWith("/messages")) {
      message(
        <>
          You have a new message.{" "}
          <Link to="/messages" className="alert-link">
            Read it
          </Link>
        </>,
        "info",
      );
    }
    seen.current = unread;
  }, [unread, pathname, message]);
  return unread;
}

// A standard Bootstrap navbar: the brand on the left, the pages and the avatar's dropdown on the
// right. Below lg it all folds into the burger menu, the account links included, and the burger
// button gets the dot for new messages. It sticks to the top of the window while the page scrolls
// (Bootstrap's sticky-top), at Bootstrap's fixed level, so it and its menus are above everything on
// the page: the messages (1025) sit just under it. White, with a light shadow, over the page's gray
// (layout.css), like Facebook's.
const ON_TOP = { zIndex: 1030 };

export default function SiteNav() {
  const { pathname } = useLocation();
  const unread = useNewMessageAlert();

  return (
    <Navbar expand="lg" sticky="top" className="bg-body shadow-sm" style={ON_TOP} collapseOnSelect>
      {/* the full width of the window, the logo at its left edge and the menu at its right, whatever
          the width of the page below */}
      <Container fluid className="navbar-row ps-lg-4">
        {/* the logo as tall as the links and the avatar, without the brand's padding, so the navbar
            keeps its height */}
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center py-0">
          <FullLogo height={40} />
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="site-menu" className="position-relative">
          <span className="navbar-toggler-icon" />
          {unread > 0 && <Dot />}
          <span className="visually-hidden">Menu{unread > 0 && `, ${unread} new ${unread === 1 ? "message" : "messages"}`}</span>
        </Navbar.Toggle>
        <Navbar.Collapse id="site-menu" className="justify-content-end align-items-lg-center">
          {/* From lg up each link has its icon above its name, like Bootstrap's header examples
              (getbootstrap.com/docs/5.3/examples/headers): outlined, and solid on the page the reader
              is on. The link loses its padding there and the name gets small (layout.css), so the
              24px icon and the name fill the same height the link had and the navbar stays as tall.
              Each is a column of the same width (layout.css), the account menu's button too, so the
              icons stand evenly apart whatever the names, like LinkedIn's. In the burger menu the
              names stand alone, at their usual size. */}
          <Nav>
            {PAGES.map(([to, label, icon, also]) => {
              const active = isPage(pathname, to, also);
              return (
                <Nav.Link key={to} as={Link} to={to} eventKey={to} active={active} className="navbar-item py-lg-0 px-lg-0 text-lg-center">
                  <Icon name={active ? `${icon}-fill` : icon} size="1.5rem" className="d-none d-lg-block mx-auto" />
                  <span className="nav-link-label d-lg-block mt-lg-1">{label}</span>
                </Nav.Link>
              );
            })}
          </Nav>
          <div className="d-lg-none">
            <AccountNav />
          </div>
          <div className="d-none d-lg-block">
            <AccountDropdown />
          </div>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
}
