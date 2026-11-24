// The image a reader saves from a track to post on Instagram (TrackPage.jsx). 4:5, the size a feed
// post keeps: the track's name, its books in order as their own covers, and where the reader is
// with each one when they've marked it. Drawn here, not photographed off the page, so the layout
// stays a poster whatever the window is doing.
import { STATUSES } from "./BookStatus.jsx";

const API = import.meta.env.VITE_API_URL ?? "/api";

const WIDTH = 1080;
const HEIGHT = 1350;
const MARGIN = 72;
const INK = "#212529";
const PAPER = "#ffffff";

const loadImage = (src) =>
  new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image.naturalWidth ? image : null);
    image.onerror = () => resolve(null);
    image.src = src;
  });

// The cover, through the API (routers/catalogue.py, get_cover), which is the same place as the page.
// A cover that never arrives is drawn as the site's plain title page instead.
async function loadCover(slug) {
  try {
    const response = await fetch(`${API}/works/${slug}/cover`, { signal: AbortSignal.timeout(8000) });
    if (!response.ok) return null;
    const blob = await response.blob();
    return await createImageBitmap(blob);
  } catch {
    return null;
  }
}

function wrap(ctx, text, maxWidth) {
  const lines = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(next).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function ellipsis(ctx, text, maxWidth) {
  if (ctx.measureText(text).width <= maxWidth) return text;
  let cut = text;
  while (cut && ctx.measureText(`${cut}…`).width > maxWidth) cut = cut.slice(0, -1);
  return cut ? `${cut}…` : "";
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// How the covers sit: one row of up to three, then a grid. The covers keep a book's shape.
function grid(count) {
  if (count <= 3) return { cols: count, rows: 1 };
  if (count === 4) return { cols: 2, rows: 2 };
  if (count <= 9) return { cols: 3, rows: Math.ceil(count / 3) };
  return { cols: 4, rows: Math.ceil(count / 4) };
}

function fitTitle(ctx, text, maxWidth) {
  for (const size of [84, 72, 60, 50, 42]) {
    ctx.font = `500 ${size}px Georgia, "Iowan Old Style", "Palatino Linotype", serif`;
    const lines = wrap(ctx, text, maxWidth).slice(0, 3);
    const joined = wrap(ctx, text, maxWidth);
    if (joined.length <= 3) return { size, lines: joined };
    if (size === 42) return { size, lines };
  }
  return { size: 42, lines: [text] };
}

function drawFallback(ctx, book, x, y, w, h) {
  rounded(ctx, x, y, w, h, 6);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = PAPER;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = INK;
  ctx.fillRect(x, y, Math.max(8, w * 0.07), h);
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `600 ${Math.max(16, w * 0.11)}px ui-sans-serif, system-ui, sans-serif`;
  const title = wrap(ctx, book.title, w * 0.7).slice(0, 5);
  const block = title.length * (w * 0.14);
  title.forEach((line, i) => ctx.fillText(line, x + w * 0.54, y + h / 2 - block / 2 + i * w * 0.14 + w * 0.06));
  if (book.surname) {
    ctx.font = `600 ${Math.max(11, w * 0.055)}px ui-sans-serif, system-ui, sans-serif`;
    ctx.fillText(book.surname.toUpperCase(), x + w * 0.54, y + h / 2 + block / 2 + w * 0.06);
  }
  ctx.restore();
}

function drawCover(ctx, image, x, y, w, h) {
  ctx.save();
  ctx.shadowColor = "rgba(0, 0, 0, 0.38)";
  ctx.shadowBlur = 28;
  ctx.shadowOffsetY = 14;
  rounded(ctx, x, y, w, h, 6);
  ctx.fillStyle = "#111";
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.clip();
  const scale = Math.min(w / image.width, h / image.height);
  const dw = image.width * scale;
  const dh = image.height * scale;
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  ctx.restore();
}

function drawCircle(ctx, n, cx, cy) {
  ctx.beginPath();
  ctx.arc(cx, cy, 26, 0, Math.PI * 2);
  ctx.fillStyle = PAPER;
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.font = "600 24px ui-sans-serif, system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(String(n), cx, cy + 1);
}

function drawPill(ctx, label, x, y, w, filled) {
  ctx.font = "600 18px ui-sans-serif, system-ui, sans-serif";
  const text = ellipsis(ctx, label, w - 28);
  rounded(ctx, x, y, w, 40, 20);
  if (filled) {
    ctx.fillStyle = PAPER;
    ctx.fill();
    ctx.fillStyle = INK;
  } else {
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
    ctx.stroke();
    ctx.fillStyle = PAPER;
  }
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, x + w / 2, y + 21);
}

// A PNG of the track, ready to download. stops: the track's books in order, each { book, number,
// status }, status one of the bookshelf's or null.
export async function renderTrackPoster(track, stops) {
  const canvas = document.createElement("canvas");
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  const logo = await loadImage("/logo.png");
  if (logo) {
    ctx.save();
    rounded(ctx, MARGIN, 60, 56, 56, 14);
    ctx.clip();
    ctx.drawImage(logo, MARGIN, 60, 56, 56);
    ctx.restore();
  }
  ctx.fillStyle = PAPER;
  ctx.textAlign = "left";
  ctx.textBaseline = "middle";
  ctx.font = "500 30px ui-sans-serif, system-ui, sans-serif";
  ctx.fillText("OpenRead", MARGIN + (logo ? 72 : 0), 88);

  ctx.font = "500 16px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.62)";
  ctx.fillText("A READING TRACK", MARGIN, 168);

  const title = fitTitle(ctx, track.title, WIDTH - MARGIN * 2);
  ctx.font = `500 ${title.size}px Georgia, "Iowan Old Style", "Palatino Linotype", serif`;
  ctx.fillStyle = PAPER;
  ctx.textBaseline = "top";
  title.lines.forEach((line, i) => ctx.fillText(line, MARGIN, 196 + i * title.size * 0.98));
  let cursor = 196 + title.lines.length * title.size * 0.98;

  const tagline = (track.tagline || track.description || "").trim();
  if (tagline) {
    ctx.font = "400 28px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = "rgba(255, 255, 255, 0.72)";
    cursor += 22;
    ctx.fillText(ellipsis(ctx, tagline, WIDTH - MARGIN * 2), MARGIN, cursor);
    cursor += 36;
  }

  const books = stops.filter((stop) => stop.book);
  if (books.length === 0) {
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }
  const marked = books.some((stop) => STATUSES[stop.status]);
  const { cols, rows } = grid(books.length);
  const gap = books.length > 6 ? 20 : 28;
  const labelH = 36 + (marked ? 52 : 0);
  const numberH = 64;
  const top = cursor + 36;
  const availW = WIDTH - MARGIN * 2;
  const availH = HEIGHT - MARGIN - 28 - top;
  let coverW = (availW - gap * (cols - 1)) / cols;
  let coverH = coverW * 1.5;
  const stack = numberH + coverH + labelH;
  if (stack * rows + gap * (rows - 1) > availH) {
    coverH = (availH - gap * (rows - 1) - (numberH + labelH) * rows) / rows;
    coverW = coverH / 1.5;
  }
  // one or two books stay a poster, not a cover blown up to the edges
  if (books.length <= 2) coverW = Math.min(coverW, 420);
  coverH = coverW * 1.5;

  const rowW = cols * coverW + (cols - 1) * gap;
  const blockH = rows * (numberH + coverH + labelH) + (rows - 1) * gap;
  const originX = MARGIN + (availW - rowW) / 2;
  const originY = top + Math.max(0, (availH - blockH) / 2);

  const images = await Promise.all(books.map((stop) => loadCover(stop.book.slug)));
  const oneRow = rows === 1 && books.length > 1;

  if (oneRow) {
    ctx.strokeStyle = PAPER;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(originX + coverW / 2, originY + 26);
    ctx.lineTo(originX + rowW - coverW / 2, originY + 26);
    ctx.stroke();
  }

  books.forEach((stop, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const x = originX + col * (coverW + gap);
    const y = originY + row * (numberH + coverH + labelH + gap);
    const image = images[i];
    if (image) drawCover(ctx, image, x, y + numberH, coverW, coverH);
    else drawFallback(ctx, stop.book, x, y + numberH, coverW, coverH);
    drawCircle(ctx, stop.number, x + coverW / 2, y + 26);
    ctx.font = "500 22px ui-sans-serif, system-ui, sans-serif";
    ctx.fillStyle = PAPER;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(ellipsis(ctx, stop.book.title, coverW - 8), x + coverW / 2, y + numberH + coverH + 12);
    const status = STATUSES[stop.status];
    if (marked && status) drawPill(ctx, status.label, x, y + numberH + coverH + 44, coverW, stop.status === "reading");
  });

  ctx.font = "500 20px ui-sans-serif, system-ui, sans-serif";
  ctx.fillStyle = "rgba(255, 255, 255, 0.55)";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("Commit to a track.  Track your reading.", WIDTH / 2, HEIGHT - 40);

  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
}

export function saveTrackPoster(blob, title) {
  const name = `${title
    .toLowerCase()
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "track"}-instagram.png`;
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}
