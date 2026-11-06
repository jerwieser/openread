import BootstrapModalManager from "react-bootstrap/BootstrapModalManager";

// The scrollbar's space is kept on every page (scrollbar-gutter in layout.css), so when a
// dialog stops the page from scrolling, the page stays as wide and nothing needs making up for.
// Bootstrap's own manager would still add the scrollbar's width as padding, and the page would move
// over by it while the dialog is open; this one counts no scrollbar. Every <Modal> gets it.
class KeptGutterManager extends BootstrapModalManager {
  getScrollbarWidth() {
    return 0;
  }
}

export const modalManager = new KeptGutterManager();
