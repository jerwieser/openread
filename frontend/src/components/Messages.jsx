// Messages: the one place the site tells readers what just happened ("Track added to your list",
// "Profile saved"). They show as Bootstrap alerts floating over the page, just under the menu while
// it's in view and at the top of the screen once it has scrolled away, the full width of the page's
// container, so they're seen however far down the reader is. They never cover the menu. Several stack one beneath the other, and each fades out by itself
// after a few seconds, or when closed. Any page can add one with useMessage(): message("Saved") or
// message("Something went wrong", "danger").
import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Alert, Container } from "react-bootstrap";

import { onBackgroundError } from "../store.js";
import Icon from "./Icon.jsx";

const MessageContext = createContext(() => {});

export const useMessage = () => useContext(MessageContext);

const ListContext = createContext([[], () => {}]);

// how long each kind stays, in ms: problems a little longer, so there's time to read them
const DURATION = { success: 2500, info: 3000, warning: 4000, danger: 6000 };
const ICON = { success: "check-circle-fill", info: "info-circle-fill", warning: "exclamation-triangle-fill", danger: "x-circle-fill" };

export function MessagesProvider({ children }) {
  const [messages, setMessages] = useState([]);
  const message = useCallback((text, variant = "success") => {
    setMessages((list) => [...list, { id: crypto.randomUUID(), text, variant }]);
  }, []);
  const remove = useCallback((id) => setMessages((list) => list.filter((m) => m.id !== id)), []);
  // a save the page didn't wait for that the API refused (see store.js) says so here too
  useEffect(() => onBackgroundError((error) => message(error.message, "danger")), [message]);

  return (
    <MessageContext.Provider value={message}>
      <ListContext.Provider value={[messages, remove]}>{children}</ListContext.Provider>
    </MessageContext.Provider>
  );
}

// One alert: it closes itself after its time, pausing while the pointer is on it, and leaves the
// list once its fade-out has finished, so the ones below slide up
function Message({ message: m, onGone }) {
  const [show, setShow] = useState(true);
  const [paused, setPaused] = useState(false);
  useEffect(() => {
    if (paused) return undefined;
    const timer = setTimeout(() => setShow(false), DURATION[m.variant]);
    return () => clearTimeout(timer);
  }, [paused, m.variant]);

  return (
    <Alert
      variant={m.variant}
      show={show}
      onClose={() => setShow(false)}
      onExited={() => onGone(m.id)}
      dismissible
      className="d-flex align-items-center gap-2 mb-2 shadow"
      style={{ pointerEvents: "auto" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <Icon name={ICON[m.variant]} className="flex-shrink-0" />
      <div>{m.text}</div>
    </Alert>
  );
}

// Where the messages start: the bottom of the menu, which sticks to the top of the screen (it grows
// when the burger menu opens), or the top of the screen on pages without one. Followed only while
// there are messages to show.
function useBelowNavbar(active) {
  const [top, setTop] = useState(0);
  useEffect(() => {
    const nav = document.querySelector(".navbar");
    if (!active || !nav) {
      setTop(0);
      return undefined;
    }
    const place = () => setTop(Math.max(0, nav.getBoundingClientRect().bottom));
    place();
    const resized = new ResizeObserver(place);
    resized.observe(nav);
    window.addEventListener("scroll", place, { passive: true });
    return () => {
      resized.disconnect();
      window.removeEventListener("scroll", place);
    };
  }, [active]);
  return top;
}

// The messages, fixed over the page, just under the menu's layer (1030) and above everything else
// on the page. The strip they sit in lets clicks through, so only the
// alerts themselves cover the page. It gets a compositing layer of its own (translateZ), so the
// browser moves it apart from the page while scrolling instead of repainting it into it: over the
// blurred track and reflection cards, Chrome and Safari otherwise leave copies of an alert behind on
// the page.
const AREA = { zIndex: 1025, pointerEvents: "none", transform: "translateZ(0)", willChange: "transform" };

export function MessageArea() {
  const [messages, remove] = useContext(ListContext);
  const top = useBelowNavbar(messages.length > 0);
  return (
    <div className="position-fixed start-0 end-0 pt-3" style={{ ...AREA, top }}>
      <Container aria-live="polite">
        {messages.map((m) => (
          <Message key={m.id} message={m} onGone={remove} />
        ))}
      </Container>
    </div>
  );
}
