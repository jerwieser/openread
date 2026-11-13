"""Language codes: BCP 47 throughout, the web's own ("nl", "grc"). Open Library's MARC codes ("dut",
"ger") are converted.
"""

import pycountry


def from_marc(code: str) -> str | None:
    """Convert a MARC (ISO 639-2/B) code: "dut" → "nl". None if it isn't a language ("und", "mul")
    or we don't know it.
    """
    code = code.strip().lower()
    if code in {"und", "mul", "zxx", "mis"}:
        return None
    language = pycountry.languages.get(bibliographic=code) or pycountry.languages.get(alpha_3=code)
    if language is None:
        return None
    return getattr(language, "alpha_2", None) or language.alpha_3


def main_language(code: str) -> str:
    """Return a tag's main language: "nl" for "nl-BE", "ru" for "ru-petr1708"."""
    return code.strip().lower().split("-")[0]
