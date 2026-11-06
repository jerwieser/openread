import { Button, Col, Container, Row } from "react-bootstrap";
import { Link } from "react-router-dom";

import { IconCircle } from "../components/Icon.jsx";
import { usePageTitle } from "../components/PageHeader.jsx";

export default function NotFoundPage() {
  usePageTitle("Page not found");
  return (
    <Container className="py-5">
      <Row className="justify-content-center text-center">
        <Col lg={8}>
          <IconCircle name="journal-x" size={80} tone="secondary" />
          <h1 className="display-5 fw-bold text-body-emphasis mt-3">This page isn&apos;t on the shelf</h1>
          <p className="lead text-body-secondary">The link may be out of date, or the book may have moved.</p>
          <div className="d-flex justify-content-center gap-2 mt-4">
            <Button as={Link} to="/discover" variant="outline-primary">
              Discover reading tracks
            </Button>
            <Button as={Link} to="/">
              Go to the home page
            </Button>
          </div>
        </Col>
      </Row>
    </Container>
  );
}
