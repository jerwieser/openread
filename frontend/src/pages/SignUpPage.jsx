import { useState } from "react";
import { FloatingLabel, Form } from "react-bootstrap";
import { Link, useNavigate, useSearchParams } from "react-router-dom";

import { AuthPage, nextPath } from "../components/Auth.jsx";
import BusyButton from "../components/BusyButton.jsx";
import { useMessage } from "../components/Messages.jsx";
import { signUp } from "../store.js";

export default function SignUpPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const message = useMessage();
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = nextPath(params);

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    const { password1, password2 } = form.elements;
    password2.setCustomValidity(password2.value === password1.value ? "" : "mismatch");
    if (!form.checkValidity()) {
      setValidated(true);
      return;
    }
    const email = form.elements.email.value.trim();
    setBusy(true);
    try {
      // the account starts with a name from the email address, which the step after confirming asks for
      await signUp(email, password1.value);
    } catch (error) {
      setBusy(false);
      message(error.message, "danger");
      return;
    }
    navigate("/verify-email", { state: { next } });
    message("Your account is created. One more step: confirm your email address.");
  }

  return (
    <AuthPage
      title="Create your account"
      switchLink={
        <>
          Have an account? <Link to={`/log-in${params.has("next") ? `?next=${encodeURIComponent(params.get("next"))}` : ""}`}>Log in</Link>
        </>
      }
    >
      <Form noValidate validated={validated} onSubmit={submit}>
        {/* greyed out while the account is being made */}
        <fieldset disabled={busy}>
          <div className="stacked">
            <FloatingLabel controlId="signup-email" label="Email address">
              <Form.Control name="email" type="email" placeholder="name@example.com" required maxLength={120} autoComplete="email" />
              <Form.Control.Feedback type="invalid">Enter an email address we can send a confirmation to.</Form.Control.Feedback>
            </FloatingLabel>
            <FloatingLabel controlId="signup-password1" label="Password">
              <Form.Control name="password1" type="password" placeholder="Password" required pattern=".{8,}" autoComplete="new-password" />
              <Form.Control.Feedback type="invalid">Use at least 8 characters.</Form.Control.Feedback>
            </FloatingLabel>
            <FloatingLabel controlId="signup-password2" label="Repeat password">
              <Form.Control
                name="password2"
                type="password"
                placeholder="Repeat password"
                required
                autoComplete="new-password"
                onChange={(e) => e.target.setCustomValidity("")}
              />
              <Form.Control.Feedback type="invalid">Enter the same password again.</Form.Control.Feedback>
            </FloatingLabel>
          </div>
          <Form.Text>Your password needs at least 8 characters.</Form.Text>
          <BusyButton type="submit" className="w-100 py-2 mt-3" busy={busy} busyText="Creating your account…">
            Create account
          </BusyButton>
        </fieldset>
        <p className="small text-body-secondary mt-3 mb-0">
          By creating an account, you agree to the <Link to="/terms">terms and conditions</Link> and the{" "}
          <Link to="/privacy">privacy statement</Link>.
        </p>
      </Form>
    </AuthPage>
  );
}
