import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The site opens with the menu and footer, and each page shows once the catalogue is in from the API
// (main.jsx, App.jsx): only then is the page's code imported. In the build, the browser is told up
// front to connect to the API and to fetch the home page's code, so the catalogue and the code arrive
// at once instead of one after the other. Fetched, not run: modulepreload doesn't run a module.
const PRELOAD = ["/src/pages/HomePage.jsx"];

function preloadOpening() {
  return {
    name: "openread-preload-opening",
    apply: "build",
    transformIndexHtml: {
      order: "post",
      handler(html, { bundle }) {
        const files = new Set();
        const add = (chunk) => {
          if (!chunk || files.has(chunk.fileName)) return;
          files.add(chunk.fileName);
          chunk.imports.forEach((name) => add(bundle[name]));
        };
        const chunks = Object.values(bundle).filter((c) => c.type === "chunk");
        PRELOAD.forEach((path) => add(chunks.find((c) => c.facadeModuleId?.endsWith(path))));
        const css = [...files].flatMap((name) => [...(bundle[name].viteMetadata?.importedCss ?? [])]);
        const link = (attrs) => ({ tag: "link", attrs, injectTo: "head" });
        return [
          // without crossorigin: the API is called with the login cookie, on the connection for those
          ...(process.env.VITE_API_URL ? [link({ rel: "preconnect", href: process.env.VITE_API_URL })] : []),
          // and to where the covers are, without crossorigin like the covers themselves, so the first
          // one doesn't wait for a connection too
          ...(process.env.VITE_MEDIA_URL ? [link({ rel: "preconnect", href: process.env.VITE_MEDIA_URL })] : []),
          // the entry's own imports are in index.html already
          ...[...files].filter((name) => !html.includes(name)).map((name) => link({ rel: "modulepreload", crossorigin: true, href: `/${name}` })),
          // crossorigin like the stylesheet links Vite adds for them later, or the browser fetches them again
          ...[...new Set(css)].filter((name) => !html.includes(name)).map((name) => link({ rel: "preload", as: "style", crossorigin: true, href: `/${name}` })),
        ];
      },
    },
  };
}

// Locally the app calls the API at /api/... and the dev server forwards those calls, so the browser
// only ever talks to one origin. In production the app is a static site and calls the API on its own
// subdomain (VITE_API_URL, see src/api.js).
export default defineConfig({
  plugins: [react(), preloadOpening()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      "/api": {
        target: process.env.API_PROXY_URL ?? "http://localhost:8000",
        rewrite: (path) => path.replace(/^\/api/, ""),
        xfwd: true, // pass the browser's IP on (X-Forwarded-For), used for rate limiting
      },
    },
  },
});
