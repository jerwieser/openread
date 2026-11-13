import { useEffect, useRef, useState } from "react";
import { Button, FloatingLabel, Form, Spinner } from "react-bootstrap";
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { AuthPage, nextPath } from "../components/Auth.jsx";
import BusyButton from "../components/BusyButton.jsx";
import { useMessage } from "../components/Messages.jsx";
import { changeEmail, logOut, resendVerification, useUser, verifyEmail } from "../store.js";

// The link in the confirmation email (/verify-email?token=…): confirms the address and logs the
// reader in, then takes them on: a new reader to the first steps, one changing their address back
// to their settings
function Confirming({ token, next }) {
  const navigate = useNavigate();
  const message = useMessage();
  const [error, setError] = useState(null);
  const sent = useRef(false); // once, also when React runs effects twice in development

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    verifyEmail(token)
      .then(() => {
        navigate(next, { replace: true });
        message("Your email address is confirmed.");
      })
      .catch((e) => setError(e.message));
  }, [token, next, navigate, message]);

  if (!error) {
    return (
      <AuthPage title="Confirming your email…">
        <Spinner animation="border" variant="primary" role="status">
          <span className="visually-hidden">Confirming</span>
        </Spinner>
      </AuthPage>
    );
  }
  return (
    <AuthPage title="This link doesn't work" switchLink={<Link to="/account">Go to your account</Link>}>
      <p>{error} Log in to ask for a new one.</p>
    </AuthPage>
  );
}

// The address was mistyped: a link goes to the right one instead
function WrongAddress() {
  const message = useMessage();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    const email = e.currentTarget.elements.email.value.trim();
    setBusy(true);
    try {
      await changeEmail(email);
    } catch (error) {
      message(error.message, "danger");
      return;
    } finally {
      setBusy(false);
    }
    setOpen(false);
    message(`We sent a link to ${email}. Open it to confirm that address.`, "info");
  }

  if (!open) {
    return (
      <p className="small mt-4 mb-0">
        Wrong address?{" "}
        <Button variant="link" className="p-0 align-baseline small" onClick={() => setOpen(true)}>
          Change it
        </Button>
      </p>
    );
  }
  return (
    <Form onSubmit={submit} className="mt-4">
      <FloatingLabel controlId="verify-new-email" label="Your email address">
        <Form.Control name="email" type="email" placeholder="name@example.com" required autoComplete="email" />
      </FloatingLabel>
      <BusyButton type="submit" className="w-100 py-2 mt-2" busy={busy} busyText="Sending…">
        Send the link there
      </BusyButton>
    </Form>
  );
}

// Until the address is confirmed, this is the only page a reader sees (App.jsx, Opened)
export default function VerifyEmailPage() {
  const [params] = useSearchParams();
  const user = useUser();
  const message = useMessage();
  const { state } = useLocation();
  const [resent, setResent] = useState(false);
  const [sending, setSending] = useState(false);
  const token = params.get("token");
  if (token) return <Confirming token={token} next={nextPath(params, "/welcome")} />;
  if (!user) return <Navigate to="/log-in" replace />;
  if (user.verified) return <Navigate to={state?.next ?? "/bookshelf"} replace />;

  async function resend() {
    setSending(true);
    try {
      await resendVerification();
    } catch (error) {
      message(error.message, "danger");
      return;
    } finally {
      setSending(false);
    }
    setResent(true);
    message(`We sent the link to ${user.email} again. It can take a minute to arrive.`, "info");
  }

  return (
    <AuthPage title="Confirm your email">
      <p>
        We&apos;ve sent a link to <b>{user.email}</b>. Open it to start using OpenRead.
      </p>
      <p className="small text-body-secondary">Nothing yet? Check your spam folder.</p>
      <div className="d-grid">
        <BusyButton variant="outline-secondary" className="py-2" onClick={resend} disabled={resent} busy={sending} busyText="Sending…">
          Send the link again
        </BusyButton>
      </div>
      <WrongAddress />
      <p className="small mt-2 mb-0">
        <Button variant="link" className="p-0 align-baseline small" onClick={logOut}>
          Log out
        </Button>
      </p>
    </AuthPage>
  );
}
