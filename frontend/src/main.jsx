import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import "bootstrap/dist/css/bootstrap.min.css";
import "./layout.css";

import App from "./App.jsx";
import { reloadForNewVersion } from "./components/ErrorBoundary.jsx";
import { load } from "./store.js";

// Code the page asks for that's gone since (the site was deployed again while it was open): a reload
// gets the new version. Vite reports it here, the page's own code and the code it shares alike; when
// it doesn't reload (it just did), the page's ErrorBoundary says something went wrong.
window.addEventListener("vite:preloadError", (event) => {
  if (reloadForNewVersion()) event.preventDefault();
});

// The menu and footer show straight away; the catalogue comes from the API meanwhile, and each page
// shows once it's there (App.jsx, Opened), since the data modules (data/*.js) and the pages build
// their lists from it when they're first run.
load();
createRoot(document.getElementById("root")).render(
  <StrictMode>
    {/* URL changes render straight away rather than as a transition: the book filters live in the
        URL, and in a transition a clicked filter button kept showing its old value until the whole
        list had re-rendered */}
    <BrowserRouter useTransitions={false}>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
