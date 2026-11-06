"""Generate DATAMODEL.md: Mermaid diagrams of the tables in api/models/.

One diagram of all the tables, then one per module, introduced by the module's docstring.

    python -m api.commands.erd           write DATAMODEL.md (make erd)
    python -m api.commands.erd --check   fail if it's out of date (CI)
"""

import argparse
import inspect
import sys
from pathlib import Path

from sqlalchemy import ARRAY, Boolean, Column, Date, DateTime, Integer, Table, Text
from sqlmodel import SQLModel

import api.models  # noqa: F401  (registers every table on SQLModel.metadata)

OUT = Path(__file__).parents[2] / "DATAMODEL.md"

# the order of the sections; a new module comes after these, by name
ORDER = ["users", "works", "authors", "expressions", "tracks", "reading", "reflections", "messages", "suggestions"]

HEADER = """# Data model

The tables in the database, drawn from `api/models/` by `make erd`. Don't edit this file: change the
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
"""


def column_type(column: Column) -> str:
    """Return the column's Postgres type as Mermaid can write it: "varchar(200)", "text[]"."""
    kind = column.type
    if isinstance(kind, ARRAY):
        return f"{column_type(Column(kind.item_type))}[]"
    if isinstance(kind, Boolean):
        return "boolean"
    if isinstance(kind, DateTime):
        return "timestamptz" if kind.timezone else "timestamp"
    if isinstance(kind, Date):
        return "date"
    if isinstance(kind, Integer):
        return "integer"
    # SQLModel's strings (AutoString) aren't String, but have a length too
    length = getattr(kind, "length", None)
    if length and not isinstance(kind, Text):
        return f"varchar({length})"
    return "text"


def keys(table: Table, column: Column) -> str:
    found = []
    if column.primary_key:
        found.append("PK")
    if column.foreign_keys:
        found.append("FK")
    # a unique index only for some rows (WHERE ...) doesn't make the column unique
    unique = column.unique or any(
        index.unique and list(index.columns) == [column] and index.dialect_options["postgresql"]["where"] is None
        for index in table.indexes
    )
    if unique and not column.primary_key:
        found.append("UK")
    return f" {','.join(found)}" if found else ""


def entity(table: Table) -> list[str]:
    lines = [f"  {table.name} {{"]
    lines += [f"    {column_type(c)} {c.name}{keys(table, c)}" for c in table.columns]
    return [*lines, "  }"]


def links(tables: list[Table]) -> list[str]:
    """The links from these tables to the ones they refer to, by column."""
    lines = []
    for table in tables:
        for fk in sorted(table.foreign_keys, key=lambda f: f.parent.name):
            one = "|o" if fk.parent.nullable else "||"
            lines.append(f'  {fk.column.table.name} {one}--o{{ {table.name} : "{fk.parent.name}"')
    return lines


def diagram(lines: list[str]) -> str:
    return "\n".join(["```mermaid", "erDiagram", *lines, "```"])


def subjects() -> list[tuple[str, str, list[Table]]]:
    """Return (name, description, tables) for each module of api/models/ with tables."""
    tables_of: dict[str, list[Table]] = {}
    for mapper in sorted(SQLModel._sa_registry.mappers, key=lambda m: m.class_.__name__):
        module = mapper.class_.__module__
        if module.startswith("api.models."):
            tables_of.setdefault(module, []).append(mapper.local_table)
    names = [module.removeprefix("api.models.") for module in tables_of]
    order = sorted(names, key=lambda n: (ORDER.index(n) if n in ORDER else len(ORDER), n))
    found = []
    for name in order:
        module = sys.modules[f"api.models.{name}"]
        # the first paragraph, on one line
        description = " ".join((inspect.getdoc(module) or "").split("\n\n")[0].split())
        tables = sorted(tables_of[f"api.models.{name}"], key=lambda t: t.name)
        found.append((name, description, tables))
    return found


def render() -> str:
    every = sorted(SQLModel.metadata.tables.values(), key=lambda t: t.name)
    parts = [
        HEADER,
        "## Everything",
        "",
        "Every table and how they're linked; their columns are below, by subject.",
        "",
    ]
    parts += [diagram([*(f"  {t.name}" for t in every), *links(every)]), ""]
    for name, description, tables in subjects():
        # the tables this subject's link to, drawn by name only: their columns are in their own section
        own = {t.name for t in tables}
        others = sorted({fk.column.table.name for t in tables for fk in t.foreign_keys} - own)
        lines = [line for t in tables for line in entity(t)] + [f"  {o}" for o in others] + links(tables)
        parts += [f"## {name.capitalize()} (`api/models/{name}.py`)", "", description, "", diagram(lines), ""]
    return "\n".join(parts)


def main() -> None:
    parser = argparse.ArgumentParser(description="Draw the data model in ./DATAMODEL.md.")
    parser.add_argument("--check", action="store_true", help="only check it's up to date")
    args = parser.parse_args()
    text = render()
    if args.check:
        if not OUT.exists() or OUT.read_text() != text:
            sys.exit("./DATAMODEL.md is out of date with api/models/: run make erd and commit it.")
        print("./DATAMODEL.md is up to date.")
        return
    OUT.write_text(text)
    print(f"Wrote {OUT}.")


if __name__ == "__main__":
    main()
