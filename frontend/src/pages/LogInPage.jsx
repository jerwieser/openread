import { useState } from "react";
import { FloatingLabel, Form } from "react-bootstrap";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";

import { AuthPage, nextPath } from "../components/Auth.jsx";
import BusyButton from "../components/BusyButton.jsx";
import { useMessage } from "../components/Messages.jsx";
import { logIn } from "../store.js";

export default function LogInPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const message = useMessage();
  // set when a page that needs an account sent the reader here
  const { state } = useLocation();
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);
  const next = nextPath(params);

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      setValidated(true);
      return;
    }
    const fields = new FormData(form);
    setBusy(true);
    let user;
    try {
      user = await logIn(fields.get("email").trim(), fields.get("password"));
    } catch (error) {
      setBusy(false);
      message(error.message, "danger");
      return;
    }
    navigate(next);
    message(`Welcome back, ${user.name.split(" ")[0]}.`);
  }

  return (
    <AuthPage
      title="Log in"
      lead={state?.why}
      switchLink={
        <>
          New here? <Link to={`/sign-up${params.size ? `?${params}` : ""}`}>Create an account</Link>
        </>
      }
    >
      <Form noValidate validated={validated} onSubmit={submit}>
        {/* greyed out while the log-in is on its way */}
        <fieldset disabled={busy}>
          <div className="stacked">
            <FloatingLabel controlId="login-email" label="Email address">
              <Form.Control name="email" type="email" placeholder="name@example.com" required autoComplete="email" />
              <Form.Control.Feedback type="invalid">Enter the email address you signed up with.</Form.Control.Feedback>
            </FloatingLabel>
            <FloatingLabel controlId="login-password" label="Password">
              <Form.Control name="password" type="password" placeholder="Password" required autoComplete="current-password" />
              <Form.Control.Feedback type="invalid">Enter your password.</Form.Control.Feedback>
            </FloatingLabel>
          </div>
          <div className="d-flex justify-content-end align-items-center my-3">
            <Link to="/forgot-password" className="small">
              Forgot password?
            </Link>
          </div>
          <BusyButton type="submit" className="w-100 py-2" busy={busy} busyText="Logging in…">
            Log in
          </BusyButton>
        </fieldset>
      </Form>
    </AuthPage>
  );
}
