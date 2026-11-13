import { Fragment, useEffect, useRef } from "react";
import { Badge, Button, Container, Dropdown, Nav, Navbar, Offcanvas, Spinner } from "react-bootstrap";
import { Link, useLocation, useNavigate } from "react-router-dom";

import { useConversations } from "../data/inbox.js";
import { isAdmin, logOut, useCatalogue, useSuggestions, useUser } from "../store.js";
import Initials from "./Initials.jsx";
import { useMessage } from "./Messages.jsx";
import { Brand } from "./Logo.jsx";

// each page in the menu, with the paths that count as being on it: Discover, which covers the tracks
// and the books it leads to, then the reader's own Bookshelf, last so it sits next to their avatar
const PAGES = [
  ["/discover", "Discover", ["/tracks", "/books"]],
  ["/bookshelf", "Bookshelf", []],
];

const isPage = (pathname, to, also) => [to, ...also].some((p) => pathname === p || pathname.startsWith(`${p}/`));

// Bootstrap's notification dot on the corner of the avatar or the burger button: there are new
// messages (getbootstrap.com/docs/5.3/components/badge/#positioned). Ringed in the bar's black.
const Dot = () => <span className="position-absolute top-0 start-100 translate-middle p-1 bg-danger border border-2 border-black rounded-circle" />;

const Unread = ({ count }) =>
  count > 0 && (
    <Badge pill bg="danger">
      {count}
      <span className="visually-hidden"> new</span>
    </Badge>
  );

// The account links in the avatar's dropdown, in groups: the reader's own pages, what they can start
// and logging out. None while the site opens: who's logged in isn't known yet, and a spinner stands
// in for the avatar.
function useAccountLinks() {
  const user = useUser();
  const opening = useCatalogue() === "loading";
  const navigate = useNavigate();
  const message = useMessage();
  const [suggestions] = useSuggestions();
  const { unread } = useConversations();
  const waiting = suggestions.filter((s) => s.status === "pending").length;

  if (opening) return { opening, user: null, unread: 0, groups: [] };
  if (!user) return { user, unread, groups: [] };
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

// The avatar's dropdown, as on daygame.pro: the reader's initials (or photo) in a circle as tall as
// the logo, opening their links, the dot on it when there are new messages; no caret (layout.css). A
// spinner in its place while the site opens, and for a logged-out visitor the buttons to log in or
// sign up instead.
function Account() {
  const { pathname } = useLocation();
  const { opening, user, unread, groups } = useAccountLinks();
  if (opening) {
    return (
      <Spinner animation="border" variant="primary" role="status" className="ms-md-2" style={{ width: 30, height: 30 }}>
        <span className="visually-hidden">Loading your account…</span>
      </Spinner>
    );
  }
  if (!user) {
    return (
      <div className="hstack gap-2 flex-grow-0 ms-md-3">
        <Button as={Link} to="/log-in" variant="outline-secondary" size="sm">
          Log in
        </Button>
        <Button as={Link} to="/sign-up" size="sm">
          Sign up
        </Button>
      </div>
    );
  }
  return (
    <Nav>
      <Dropdown as={Nav.Item} align="end">
        <Dropdown.Toggle as="button" id="account-menu" className="navbar-account nav-link py-0 pe-0 border-0 bg-transparent">
          <span className="position-relative d-inline-flex">
            <Initials name={user.name} photo={user.photo} size={30} />
            {unread > 0 && <Dot />}
          </span>
          <span className="visually-hidden">
            Account menu for {user.name}
            {unread > 0 && `, ${unread} new ${unread === 1 ? "message" : "messages"}`}
          </span>
        </Dropdown.Toggle>
        {/* in the page's light colours, under the dark bar */}
        <Dropdown.Menu data-bs-theme="light">
          <Dropdown.Header>
            <div className="fw-semibold text-body-emphasis">{user.name}</div>
            {user.email}
          </Dropdown.Header>
          {groups.map((group, i) => (
            <Fragment key={i}>
              <Dropdown.Divider />
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

// daygame.pro's navbar: a dark bar stuck to the top of the window (black at 90%), the square logo and
// the name on the left, the pages as plain links and the avatar's dropdown on the right. Below md
// they move into an offcanvas drawer from the right, opened by the burger button, which gets the dot
// for new messages; choosing a link closes it. At Bootstrap's fixed level, so it and its menus are
// above everything on the page: the messages (1025) sit just under it.
const BAR = { zIndex: 1030, "--bs-bg-opacity": 0.9 };

export default function SiteNav() {
  const { pathname } = useLocation();
  const unread = useNewMessageAlert();

  return (
    <Navbar expand="md" sticky="top" className="bg-black border-bottom border-black" style={BAR} data-bs-theme="dark" collapseOnSelect>
      <Container fluid>
        <Navbar.Brand as={Link} to="/" className="d-flex align-items-center">
          <Brand size={30} />
        </Navbar.Brand>
        <Navbar.Toggle aria-controls="site-menu" className="position-relative">
          <span className="navbar-toggler-icon" />
          {unread > 0 && <Dot />}
          <span className="visually-hidden">Menu{unread > 0 && `, ${unread} new ${unread === 1 ? "message" : "messages"}`}</span>
        </Navbar.Toggle>
        {/* the drawer is put on the page outside the bar, so it's told to be dark itself */}
        <Navbar.Offcanvas id="site-menu" placement="end" aria-labelledby="site-menu-title" data-bs-theme="dark">
          <Offcanvas.Header closeButton>
            <Offcanvas.Title id="site-menu-title">OpenRead</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body className="align-items-md-center">
            <Nav className="ms-md-auto">
              {PAGES.map(([to, label, also]) => (
                <Nav.Link key={to} as={Link} to={to} eventKey={to} active={isPage(pathname, to, also)}>
                  {label}
                </Nav.Link>
              ))}
            </Nav>
            <Account />
          </Offcanvas.Body>
        </Navbar.Offcanvas>
      </Container>
    </Navbar>
  );
}
