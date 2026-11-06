// The grids track and book cards sit in, the same on every page, so a track or a book is the same size
// wherever it shows (Row props: <Row {...TRACK_GRID}>, and the same for GridPlaceholder and
// ScrollGrid). Tracks: one to a row on a phone, two on a tablet, three from a laptop up. Books: two on a phone, three on
// a tablet, six on a laptop and nine from 1200px up (row-cols-xl-9, layout.css), so wider screens
// show more books rather than bigger ones. The book page's own rows of related books are smaller on
// purpose.
export const TRACK_GRID = { xs: 1, md: 2, lg: 3, className: "g-4 justify-content-center" };
// Books closer together than tracks: 0.75rem between covers across, 1.25rem between rows, where each
// card's title and author need room to read as its own. Between Bootstrap's gutter sizes (gx-2 and
// gx-3), so as the Row's own gutter variables.
export const BOOK_GRID = {
  xs: 2,
  sm: 3,
  lg: 6,
  xl: 9,
  className: "justify-content-center",
  style: { "--bs-gutter-x": "0.75rem", "--bs-gutter-y": "1.25rem" },
};
