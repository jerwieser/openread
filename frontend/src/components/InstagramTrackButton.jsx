import { useState } from "react";

import BusyButton from "./BusyButton.jsx";
import { useMessage } from "./Messages.jsx";
import { renderTrackPoster, saveTrackPoster } from "./TrackPoster.js";

// On a track's page. Saves a 4:5 image of the track, its covers in order, for an Instagram post.
export default function InstagramTrackButton({ track, stops }) {
  const [busy, setBusy] = useState(false);
  const message = useMessage();

  async function save() {
    setBusy(true);
    try {
      const blob = await renderTrackPoster(track, stops);
      if (!blob) throw new Error("empty");
      saveTrackPoster(blob, track.title);
    } catch {
      message("The image couldn't be made. Try again in a moment.", "danger");
    } finally {
      setBusy(false);
    }
  }

  return (
    <BusyButton variant="link" size="sm" className="link-secondary" busy={busy} busyText="Making the image…" onClick={save}>
      Instagram image
    </BusyButton>
  );
}
