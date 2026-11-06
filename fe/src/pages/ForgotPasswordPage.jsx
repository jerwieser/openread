import { useState } from "react";
import { FloatingLabel, Form } from "react-bootstrap";
import { Link } from "react-router-dom";

import { AuthPage } from "../components/Auth.jsx";
import BusyButton from "../components/BusyButton.jsx";
import { useMessage } from "../components/Messages.jsx";
import { forgotPassword } from "../store.js";

export default function ForgotPasswordPage() {
  const [validated, setValidated] = useState(false);
  const [sentTo, setSentTo] = useState(null);
  const [busy, setBusy] = useState(false);
  const message = useMessage();

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      setValidated(true);
      return;
    }
    const email = new FormData(form).get("email").trim();
    setBusy(true);
    try {
      await forgotPassword(email);
    } catch (error) {
      setBusy(false);
      message(error.message, "danger");
      return;
    }
    setSentTo(email);
  }

  const back = <Link to="/log-in">Back to log in</Link>;

  if (sentTo) {
    return (
      <AuthPage title="Check your email" switchLink={back}>
        {/* the same answer whether or not the address has an account, so this page can't be used to find out */}
        <p>
          If there&apos;s an account for <b>{sentTo}</b>, we&apos;ve sent it a link to choose a new password. The
          link works for one hour.
        </p>
        <p className="small text-body-secondary mb-0">Nothing arrived? Check your spam folder, or try again in a few minutes.</p>
      </AuthPage>
    );
  }

  return (
    <AuthPage
      title="Forgot your password?"
      lead="Enter the email you signed up with and we'll send you a link to choose a new one."
      switchLink={back}
    >
      <Form noValidate validated={validated} onSubmit={submit}>
        <fieldset disabled={busy}>
          <FloatingLabel controlId="forgot-email" label="Email address">
            <Form.Control name="email" type="email" placeholder="name@example.com" required autoComplete="email" />
            <Form.Control.Feedback type="invalid">Enter your email address.</Form.Control.Feedback>
          </FloatingLabel>
          <BusyButton type="submit" className="w-100 py-2 mt-3" busy={busy} busyText="Sending…">
            Send reset link
          </BusyButton>
        </fieldset>
      </Form>
    </AuthPage>
  );
}
