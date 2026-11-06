<img src="fe/public/favicon.svg" alt="OpenRead icon" width="96">

# OpenRead

The right books, in the right order. Pick a subject, follow a reading track of books through it one at a time, and talk to readers who have read them. OpenRead is an alternative for Goodreads. No ads, no commercial incentive. Just a free easy-to-use web-application.

Live at [openread.cloud](https://www.openread.cloud).

## Features

- **Reading tracks**: a handful of books, in order, that take you into one subject.
- **Your bookshelf**: what you want to read, are reading and have finished.
- **Readers**: see who has read a book, ask them about it, and write reflections.
- **Your own tracks**: put books in your own order and share them with a link.

## Built with

- `fe/`: the site, in React and Vite
- `api/`: the API, in FastAPI and SQLModel
- `db/`: PostgreSQL migrations, with Alembic

## Getting started

You need [Docker](https://docs.docker.com/get-docker/) and `make`.

```bash
make up
```

- The site: http://localhost:5173
- The API docs: http://localhost:8000/docs

A new local database is empty, so sign up to get an account. Emails aren't sent locally: they're
printed in the logs (`make logs`), confirmation link included.

Run `make help` to see all the commands. `make test` runs the tests, which also need
[uv](https://docs.astral.sh/uv/).

## Contributing

Issues and pull requests are welcome. Please follow the [code of conduct](CODE_OF_CONDUCT.md), and
report security problems as described in [SECURITY.md](SECURITY.md).

## License

The code is under the GNU AGPL v3.0, and the catalogue of books and tracks under CC BY-SA 4.0.
