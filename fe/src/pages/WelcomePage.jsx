import { useState } from "react";
import { Button, Form } from "react-bootstrap";
import { Link, Navigate, useLocation, useNavigate } from "react-router-dom";

import { AuthPage } from "../components/Auth.jsx";
import BusyButton from "../components/BusyButton.jsx";
import { useMessage } from "../components/Messages.jsx";
import ProfileFields, { profileFrom } from "../components/ProfileFields.jsx";
import { updateAccount, useUser } from "../store.js";

// Straight after confirming the email address: the profile other readers see, then bringing their
// books over from Goodreads or The StoryGraph (WelcomeImportPage). Everything but the name can wait,
// and the whole step can be skipped and done later under Account.
export default function WelcomePage() {
  const user = useUser();
  const navigate = useNavigate();
  const message = useMessage();
  const { state } = useLocation();
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!user) return <Navigate to="/sign-up" replace />;
  const onward = () => navigate("/welcome/import", { state });

  async function submit(e) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!form.checkValidity()) {
      setValidated(true);
      return;
    }
    const profile = profileFrom(new FormData(form));
    setBusy(true);
    try {
      await updateAccount(profile);
    } catch (error) {
      setBusy(false);
      message(error.message, "danger");
      return;
    }
    onward();
    message("Your profile is saved. Other readers can see it now.");
  }

  return (
    <AuthPage
      title="Tell other readers about yourself"
      lead="Your profile is what other readers see when you ask them a question. Only your name is needed now."
      width={560}
    >
      <Form noValidate validated={validated} onSubmit={submit}>
        <fieldset disabled={busy}>
          <ProfileFields user={user} />
          <div className="d-flex flex-wrap align-items-center gap-3">
            <BusyButton type="submit" className="py-2 px-4" busy={busy} busyText="Saving…">
              Save profile
            </BusyButton>
            <Button variant="link" className="p-0" onClick={onward}>
              Skip for now
            </Button>
          </div>
          <p className="small text-body-secondary mt-3 mb-0">
            You can change it any time in <Link to="/account">Settings</Link>.
          </p>
        </fieldset>
      </Form>
    </AuthPage>
  );
}
