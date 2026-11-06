import { Card } from "react-bootstrap";
import { Link } from "react-router-dom";

import { aboutLine } from "../data/readers.js";
import { SubtleBadge } from "./Badges.jsx";
import Initials from "./Initials.jsx";

// a reader's name as a link to their profile; someone who has left as plain text
export function ReaderName({ reader, name, className = "" }) {
  return reader ? (
    <Link to={`/readers/${reader.id}`} className={`link-body-emphasis ${className}`}>
      {reader.name}
    </Link>
  ) : (
    <span className={className}>{name}</span>
  );
}

// A reader on a card: who they are, what they know and how much they've read
export default function ReaderCard({ reader, compact = false }) {
  return (
    <Card className="h-100 shadow-sm">
      <Card.Body className="d-flex flex-column">
        <div className="d-flex align-items-center gap-3 mb-3">
          <Initials name={reader.name} photo={reader.photo} size={56} />
          <div>
            <Card.Title as="h3" className="h5 fw-bold mb-0">
              <Link to={`/readers/${reader.id}`} className="stretched-link link-body-emphasis text-decoration-none">
                {reader.name}
              </Link>
            </Card.Title>
            <div className="small text-body-secondary">{aboutLine(reader)}</div>
          </div>
        </div>
        {!compact && <Card.Text>{reader.bio}</Card.Text>}
        <div className="d-flex flex-wrap gap-1 mb-3">
          {reader.fields.map((f) => (
            <SubtleBadge key={f}>{f}</SubtleBadge>
          ))}
        </div>
        <div className="small text-body-secondary mt-auto pt-2 border-top">
          {reader.read.length} books read{reader.reading.length > 0 && ` · reading ${reader.reading.length} now`}
        </div>
      </Card.Body>
    </Card>
  );
}
