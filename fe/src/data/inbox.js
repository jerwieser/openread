// Messages between readers, grouped into conversations: one per other reader, with the questions
// asked from profiles and book pages as their first messages. OpenRead itself writes too, like the
// welcome message: it isn't a reader, and its messages can't be answered.
import { postMessage, read, useInbox, useStore, useUser } from "../store.js";
import { readerById } from "./readers.js";

export const OPENREAD = { id: "openread", name: "OpenRead", tagline: "Messages from the site", photo: "/favicon.svg" };

// who a conversation is with
export const correspondent = (id) => (id === OPENREAD.id ? OPENREAD : readerById(id));

// Sends a message from the signed-in reader
export const sendMessage = (to, text) => postMessage(to.id, text);

// The reader's conversations, newest first: the other reader, their messages oldest first, the
// last one and how many of theirs are unread
export function conversationsOf(userId, messages) {
  const byOther = new Map();
  for (const m of messages) {
    if (m.from !== userId && m.to !== userId) continue;
    const other = m.from === userId ? m.to : m.from;
    byOther.set(other, [...(byOther.get(other) ?? []), m]);
  }
  return [...byOther]
    .map(([id, list]) => {
      const sorted = list.toSorted((a, b) => a.createdAt.localeCompare(b.createdAt));
      return { id, reader: correspondent(id), messages: sorted, last: sorted.at(-1), unread: sorted.filter((m) => m.to === userId && !m.readAt).length };
    })
    .toSorted((a, b) => b.last.createdAt.localeCompare(a.last.createdAt));
}

// The signed-in reader's conversations and unread count, kept up to date
export function useConversations() {
  const user = useUser();
  const messages = useInbox();
  useStore(() => read("readers")); // the other readers' names and photos
  const list = user ? conversationsOf(user.id, messages) : [];
  return { conversations: list, unread: list.reduce((sum, c) => sum + c.unread, 0) };
}

const timeFormat = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit" });
const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short" });

// "14:05" for today, "23 Oct" before that
export function sentAt(iso) {
  const d = new Date(iso);
  return d.toDateString() === new Date().toDateString() ? timeFormat.format(d) : dayFormat.format(d);
}
