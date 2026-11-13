import { useRef, useState } from "react";
import { Button, Col, Form, Row } from "react-bootstrap";

import { languageName } from "../data/languages.js";
import { FIELDS, LANGUAGES } from "../data/readers.js";
import Initials from "./Initials.jsx";

// a photo as a small square JPEG: cropped to its centre and scaled to SIDE pixels, so it is light
// enough to keep with the account in the browser and sharp enough for the largest avatar (128px, at 2×)
const SIDE = 256;

function squarePhoto(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const crop = Math.min(img.naturalWidth, img.naturalHeight);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIDE;
      canvas.getContext("2d").drawImage(img, (img.naturalWidth - crop) / 2, (img.naturalHeight - crop) / 2, crop, crop, 0, 0, SIDE, SIDE);
      URL.revokeObjectURL(img.src);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// The avatar other readers see: a photo the reader picks, or their initials until they do. The photo
// travels with the rest of the form in a hidden field, so saving the form saves it.
function PhotoField({ user }) {
  const [photo, setPhoto] = useState(user.photo ?? "");
  const [error, setError] = useState("");
  const input = useRef(null);
  async function choose(e) {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Choose an image file, such as a JPEG or PNG.");
    try {
      setPhoto(await squarePhoto(file));
      setError("");
    } catch {
      setError("That image couldn't be read. Try another one.");
    }
  }
  return (
    <div className="d-flex align-items-center gap-3 mb-3">
      <Initials name={user.name || "?"} photo={photo} size={72} />
      <div>
        <div className="form-label mb-1">Photo</div>
        <div className="d-flex flex-wrap gap-2">
          <Button variant="outline-primary" size="sm" onClick={() => input.current.click()}>
            {photo ? "Change photo" : "Upload a photo"}
          </Button>
          {photo && (
            <Button variant="link" size="sm" className="link-secondary" onClick={() => setPhoto("")}>
              Use my initials
            </Button>
          )}
        </div>
        {error ? <div className="small text-danger mt-1">{error}</div> : <Form.Text>Shown as your icon in the menu and on your profile.</Form.Text>}
        <input ref={input} type="file" accept="image/*" className="d-none" onChange={choose} aria-label="Upload a photo" />
        <input type="hidden" name="photo" value={photo} />
      </div>
    </div>
  );
}

// The profile other readers see, as form fields: on the welcome step after signing up and under
// Account. profileFrom reads them back out of the form.
export default function ProfileFields({ user }) {
  return (
    <>
      <PhotoField user={user} />
      <Row className="g-3 mb-3">
        <Form.Group as={Col} sm={6} controlId="profile-name">
          <Form.Label>Name</Form.Label>
          <Form.Control name="name" defaultValue={user.name} required maxLength={80} autoComplete="name" />
          <Form.Control.Feedback type="invalid">Enter the name other readers will see.</Form.Control.Feedback>
        </Form.Group>
        <Form.Group as={Col} sm={6} controlId="profile-location">
          <Form.Label>Where you are</Form.Label>
          <Form.Control name="location" defaultValue={user.location} maxLength={60} placeholder="City" autoComplete="address-level2" />
        </Form.Group>
      </Row>
      <Form.Group className="mb-3" controlId="profile-tagline">
        <Form.Label>One line about you</Form.Label>
        <Form.Control name="tagline" defaultValue={user.tagline} maxLength={60} placeholder="For example: history student, slow reader" />
      </Form.Group>
      <Form.Group className="mb-3" controlId="profile-bio">
        <Form.Label>Bio</Form.Label>
        <Form.Control
          as="textarea"
          name="bio"
          rows={4}
          maxLength={600}
          defaultValue={user.bio}
          placeholder="What you like to read, what you'd like to read next, and what you bring to a conversation about a book."
        />
        <Form.Text>Readers see this on your profile before they send you a question.</Form.Text>
      </Form.Group>
      <Row className="g-3 mb-4">
        <Col sm={6}>
          <fieldset>
            <legend className="form-label fs-6">You know most about</legend>
            {FIELDS.map((f) => (
              <Form.Check key={f} type="checkbox" name="fields" value={f} id={`profile-field-${f}`} label={f} defaultChecked={user.fields?.includes(f)} />
            ))}
          </fieldset>
        </Col>
        <Col sm={6}>
          <fieldset>
            <legend className="form-label fs-6">You talk about books in</legend>
            <Row xs={2} className="g-0">
              {LANGUAGES.map((l) => (
                <Col key={l}>
                  <Form.Check
                    type="checkbox"
                    name="languages"
                    value={l}
                    id={`profile-language-${l}`}
                    label={languageName(l) ?? l}
                    defaultChecked={user.languages?.includes(l)}
                  />
                </Col>
              ))}
            </Row>
          </fieldset>
        </Col>
      </Row>
    </>
  );
}

export function profileFrom(fields) {
  return {
    name: fields.get("name").trim(),
    location: fields.get("location").trim(),
    tagline: fields.get("tagline").trim(),
    bio: fields.get("bio").trim(),
    fields: fields.getAll("fields"),
    languages: fields.getAll("languages"),
    photo: fields.get("photo") || null,
  };
}
