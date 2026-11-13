# Data model

The tables in the database, drawn from `backend/models/` by `make erd`. Don't edit this file: change the
models and run it again. CI checks it's up to date.

## Terms

The words come from the library standard IFLA LRM, and mean the same in the code, the database and
the API:

- **work**: a book as its author made it, in any language or print: Bonita Avenue, by Peter Buwalda.
  Readers read works, follow them on tracks and write reflections about them. The site calls them
  books.
- **expression**: one text of a work in one language, with its own title: the Russian original "Война
  и мир", or the Dutch translation "Oorlog en vrede".
- **edition**: one publication of an expression, with its year, publisher, cover and ISBN: the Pushkin
  Press paperback of 2014 of the English Bonita Avenue.

A work holds what's true in any language: who wrote it and when it first came out. Its titles are on
its expressions. A reader's status is for the work, whatever language or edition they read. They
see titles in their reading languages (`users.reading_languages`) and the site in their own
(`users.site_language`). Authors have names in other languages too (`author_names`), so a Russian
reader sees "Лев Толстой".

## Diagrams

Keys: PK primary key, FK a link to another table, UK unique. A line between two tables is one of
those links, named by its column: `||` exactly one, `|o` one or none, `o{` any number.

## Everything

Every table and how they're linked; their columns are below, by subject.

```mermaid
erDiagram
  author_names
  authors
  editions
  expressions
  messages
  readings
  reflections
  suggestions
  track_follows
  track_skips
  track_stop_translations
  track_stops
  track_translations
  tracks
  users
  work_authors
  works
  authors ||--o{ author_names : "author_id"
  expressions ||--o{ editions : "expression_id"
  works ||--o{ expressions : "work_id"
  users ||--o{ messages : "recipient_id"
  users |o--o{ messages : "sender_id"
  users ||--o{ readings : "user_id"
  works ||--o{ readings : "work_id"
  users ||--o{ reflections : "user_id"
  works ||--o{ reflections : "work_id"
  users ||--o{ suggestions : "user_id"
  works |o--o{ suggestions : "work_id"
  tracks ||--o{ track_follows : "track_id"
  users ||--o{ track_follows : "user_id"
  tracks ||--o{ track_skips : "track_id"
  users ||--o{ track_skips : "user_id"
  works ||--o{ track_skips : "work_id"
  tracks ||--o{ track_stop_translations : "track_id"
  works ||--o{ track_stop_translations : "work_id"
  tracks ||--o{ track_stops : "track_id"
  works ||--o{ track_stops : "work_id"
  tracks ||--o{ track_translations : "track_id"
  users |o--o{ tracks : "owner_id"
  authors ||--o{ work_authors : "author_id"
  works ||--o{ work_authors : "work_id"
```

## Users (`backend/models/users.py`)

Readers: the user table, public profiles and account settings.

```mermaid
erDiagram
  users {
    integer id PK
    varchar(60) handle UK
    varchar(255) email UK
    varchar(100) name
    varchar(255) hashed_password
    boolean is_email_verified
    varchar(20) role
    varchar(100) tagline
    varchar(100) location
    text bio
    varchar(100)[] languages
    varchar(100)[] fields
    text photo
    varchar(20) site_language
    varchar(100)[] reading_languages
    timestamptz created_at
    timestamptz updated_at
  }
```

## Works (`backend/models/works.py`)

Works: what readers call books. Their titles are on their expressions.

```mermaid
erDiagram
  work_authors {
    integer work_id PK,FK
    integer author_id PK,FK
    integer position
  }
  works {
    integer id PK
    varchar(200) slug UK
    integer year
    boolean is_year_approximate
    text url
    varchar(20) difficulty
    boolean is_curated
    varchar(20) source
    varchar(20) ol_work UK
    varchar(100)[] other_ol_works
    varchar(20) wikidata UK
    varchar(100)[] categories
    timestamptz identified_at
    timestamptz created_at
    timestamptz updated_at
  }
  authors
  authors ||--o{ work_authors : "author_id"
  works ||--o{ work_authors : "work_id"
```

## Authors (`backend/models/authors.py`)

Authors of works, and their names in other languages.

```mermaid
erDiagram
  author_names {
    integer author_id PK,FK
    varchar(20) language PK
    varchar(200) name
  }
  authors {
    integer id PK
    varchar(200) slug UK
    varchar(200) name
    varchar(20) wikidata UK
    timestamptz created_at
    timestamptz updated_at
  }
  authors ||--o{ author_names : "author_id"
```

## Expressions (`backend/models/expressions.py`)

A work's expressions and editions. An expression is one text of a work in one language, with its own title. An edition is one publication of an expression. A work's cover is a special edition without an ISBN: a work has one cover, not one per edition or language.

```mermaid
erDiagram
  editions {
    integer id PK
    integer expression_id FK
    varchar(13) isbn UK
    varchar(20) ol_edition UK
    varchar(300) publisher
    integer year
    varchar(200) cover
    text cover_source
    timestamptz created_at
    timestamptz updated_at
  }
  expressions {
    integer id PK
    integer work_id FK
    varchar(20) language
    varchar(500) title
    boolean is_original
    integer year
    timestamptz created_at
    timestamptz updated_at
  }
  works
  expressions ||--o{ editions : "expression_id"
  works ||--o{ expressions : "work_id"
```

## Tracks (`backend/models/tracks.py`)

Reading tracks: ours and the ones readers make, and their stops in reading order.

```mermaid
erDiagram
  track_stop_translations {
    integer track_id PK,FK
    integer work_id PK,FK
    varchar(20) language PK
    text note
    timestamptz created_at
    timestamptz updated_at
  }
  track_stops {
    integer id PK
    integer track_id FK
    integer position
    integer work_id FK
    varchar(200) canon_window
    text note
  }
  track_translations {
    integer track_id PK,FK
    varchar(20) language PK
    varchar(120) title
    varchar(200) tagline
    text description
    timestamptz created_at
    timestamptz updated_at
  }
  tracks {
    integer id PK
    varchar(120) slug UK
    integer owner_id FK
    varchar(120) title
    varchar(200) tagline
    text description
    varchar(100)[] tags
    text image
    varchar(200) source_label
    text source_url
    integer position
    timestamptz retired_at
    timestamptz created_at
    timestamptz updated_at
  }
  users
  works
  tracks ||--o{ track_stop_translations : "track_id"
  works ||--o{ track_stop_translations : "work_id"
  tracks ||--o{ track_stops : "track_id"
  works ||--o{ track_stops : "work_id"
  tracks ||--o{ track_translations : "track_id"
  users |o--o{ tracks : "owner_id"
```

## Reading (`backend/models/reading.py`)

A reader's bookshelf: their status for each work, and the tracks they keep.

```mermaid
erDiagram
  readings {
    integer user_id PK,FK
    integer work_id PK,FK
    varchar(10) status
    date started_on
    date finished_on
    integer progress
    timestamptz created_at
    timestamptz updated_at
  }
  track_follows {
    integer user_id PK,FK
    integer track_id PK,FK
    varchar(10) state
    timestamptz started_at
    timestamptz paused_at
    timestamptz completed_at
    timestamptz created_at
    timestamptz updated_at
  }
  track_skips {
    integer user_id PK,FK
    integer track_id PK,FK
    integer work_id PK,FK
    varchar(20) reason
    timestamptz created_at
  }
  tracks
  users
  works
  users ||--o{ readings : "user_id"
  works ||--o{ readings : "work_id"
  tracks ||--o{ track_follows : "track_id"
  users ||--o{ track_follows : "user_id"
  tracks ||--o{ track_skips : "track_id"
  users ||--o{ track_skips : "user_id"
  works ||--o{ track_skips : "work_id"
```

## Reflections (`backend/models/reflections.py`)

Reflections: essays readers write about works they read.

```mermaid
erDiagram
  reflections {
    integer id PK
    varchar(120) slug UK
    integer user_id FK
    integer work_id FK
    varchar(200) title
    text body
    varchar(20) status
    date written_on
    timestamptz created_at
    timestamptz updated_at
  }
  users
  works
  users ||--o{ reflections : "user_id"
  works ||--o{ reflections : "work_id"
```

## Messages (`backend/models/messages.py`)

Messages between readers, plain text only, and from OpenRead itself.

```mermaid
erDiagram
  messages {
    integer id PK
    integer sender_id FK
    integer recipient_id FK
    text body
    timestamptz created_at
    timestamptz read_at
  }
  users
  users ||--o{ messages : "recipient_id"
  users |o--o{ messages : "sender_id"
```

## Suggestions (`backend/models/suggestions.py`)

Works readers suggest for the catalogue, and the admins who review them.

```mermaid
erDiagram
  suggestions {
    integer id PK
    integer user_id FK
    varchar(300) title
    varchar(200) author
    integer year
    text url
    text cover
    text note
    varchar(20) difficulty
    varchar(20) status
    text reason
    integer work_id FK
    varchar(20) ol_work
    timestamptz created_at
    timestamptz updated_at
    timestamptz decided_at
  }
  users
  works
  users ||--o{ suggestions : "user_id"
  works |o--o{ suggestions : "work_id"
```
