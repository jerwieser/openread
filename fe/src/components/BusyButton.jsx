import { Button, Spinner } from "react-bootstrap";

// A button whose request the page waits on, after Bootstrap's loading buttons
// (getbootstrap.com/docs/5.3/components/spinners/#buttons): while busy it's disabled, with a small
// spinner before words that say what's happening ("Logging in…"), and aria-busy for screen readers.
// Put the form's fields in <fieldset disabled={busy}> beside it, so they grey out too and can't be
// changed or sent twice meanwhile.
export default function BusyButton({ busy, busyText, disabled, children, ...props }) {
  return (
    <Button disabled={busy || disabled} aria-busy={busy || undefined} {...props}>
      {busy ? (
        <>
          <Spinner as="span" animation="border" size="sm" aria-hidden="true" className="me-2" />
          {busyText ?? children}
        </>
      ) : (
        children
      )}
    </Button>
  );
}
