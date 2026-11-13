import { Badge } from "react-bootstrap";
import { Link } from "react-router-dom";

import { sentAt } from "../data/inbox.js";
import Initials from "./Initials.jsx";

// The reader's conversations as a Bootstrap list group (getbootstrap.com/docs/5.3/examples/list-groups):
// who it's with, the last message and when, and a count of the unread ones. Unread conversations
// are in bold.
export default function ConversationList({ conversations, userId }) {
  return (
    <div className="list-group shadow-sm">
      {conversations.map((c) => (
        <Link key={c.id} to={`/messages/${c.id}`} className="list-group-item list-group-item-action d-flex gap-3 py-3">
          <Initials name={c.reader?.name ?? "?"} photo={c.reader?.photo} size={40} />
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="d-flex justify-content-between gap-2">
              <span className={c.unread ? "fw-bold" : "fw-semibold"}>{c.reader?.name ?? "A former reader"}</span>
              <small className="text-body-secondary text-nowrap">{sentAt(c.last.createdAt)}</small>
            </div>
            <div className={`small text-truncate ${c.unread ? "text-body" : "text-body-secondary"}`}>
              {c.last.from === userId && "You: "}
              {c.last.text}
            </div>
          </div>
          {c.unread > 0 && (
            <Badge pill bg="danger" className="align-self-center">
              {c.unread}
              <span className="visually-hidden"> unread</span>
            </Badge>
          )}
        </Link>
      ))}
    </div>
  );
}
