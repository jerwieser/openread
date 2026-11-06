import { useState } from "react";
import { Button, FloatingLabel, Form } from "react-bootstrap";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { AuthPage } from "../components/Auth.jsx";
import BusyButton from "../components/BusyButton.jsx";
import { useMessage } from "../components/Messages.jsx";
import { resetPassword } from "../store.js";

// Where the link in the reset email leads (/reset-password?token=…): a new password, and the reader
// is logged in with it
export default function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const message = useMessage();
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);
  const token = params.get("token");

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const { password, confirm } = form.elements;
    confirm.setCustomValidity(confirm.value === password.value ? "" : "mismatch");
    if (!form.checkValidity()) {
      setValidated(true);
      return;
    }
    setBusy(true);
    try {
      await resetPassword(token, password.value);
    } catch (error) {
      setBusy(false);
      message(error.message, "danger");
      return;
    }
    navigate("/bookshelf");
    message("Your new password is set, and you're logged in.");
  }

  if (!token) {
    return (
      <AuthPage title="This link doesn't work" switchLink={<Link to="/log-in">Back to log in</Link>}>
        <p>Open the link from the email we sent you, or ask for a new one.</p>
        <Button as={Link} to="/forgot-password" className="w-100 py-2">
          Send a new link
        </Button>
      </AuthPage>
    );
  }

  return (
    <AuthPage title="Choose a new password" switchLink={<Link to="/log-in">Back to log in</Link>}>
      <Form noValidate validated={validated} onSubmit={submit}>
        <fieldset disabled={busy}>
          <div className="stacked">
            <FloatingLabel controlId="reset-password" label="New password">
              <Form.Control name="password" type="password" placeholder="New password" required pattern=".{8,}" autoComplete="new-password" />
              <Form.Control.Feedback type="invalid">Use at least 8 characters.</Form.Control.Feedback>
            </FloatingLabel>
            <FloatingLabel controlId="reset-confirm" label="Repeat new password">
              <Form.Control
                name="confirm"
                type="password"
                placeholder="Repeat new password"
                required
                autoComplete="new-password"
                onChange={(e) => e.target.setCustomValidity("")}
              />
              <Form.Control.Feedback type="invalid">The two passwords don&apos;t match.</Form.Control.Feedback>
            </FloatingLabel>
          </div>
          <Form.Text>At least 8 characters.</Form.Text>
          <BusyButton type="submit" className="w-100 py-2 mt-3" busy={busy} busyText="Saving…">
            Set new password
          </BusyButton>
        </fieldset>
      </Form>
    </AuthPage>
  );
}
