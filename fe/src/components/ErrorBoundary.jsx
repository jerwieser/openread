// What shows instead of a blank page when part of the site fails. The usual cause is a page's code
// from an older version of the site: a tab left open across a deploy still asks for the old files,
// which the new version doesn't have. A reload gets the new version, so that happens by itself,
// once; anything else says so, with a button to reload.
import { Component } from "react";

// how browsers word a module that couldn't be fetched (Chrome, Safari, Firefox; Vite for CSS)
const STALE_CODE = /dynamically imported module|Importing a module script failed|Unable to preload CSS/i;

// Reloads for the site's new version, unless it already did in the last minute: a file that's really
// missing would reload forever. Says whether it reloaded.
export function reloadForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem("openread-reloaded") ?? 0);
    if (Date.now() - last < 60_000) return false;
    sessionStorage.setItem("openread-reloaded", String(Date.now()));
  } catch {
    // no session storage (blocked): no way to tell a second time, so no reload by itself
    return false;
  }
  window.location.reload();
  return true;
}

// Around the pages (App.jsx): a page that fails shows this in its place, the menu and footer stay,
// and opening another page (resetKey, its path) tries again.
export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error) {
    console.error(error);
    if (STALE_CODE.test(error?.message ?? "")) reloadForNewVersion();
  }

  componentDidUpdate(previous) {
    if (this.state.error && previous.resetKey !== this.props.resetKey) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="container py-5 text-center">
        <h1 className="h3">Something went wrong on this page</h1>
        <p className="text-body-secondary">Reloading usually sorts it out.</p>
        <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
