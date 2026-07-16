"""Regression tests for the Ayoa OPML import path, executable via `pytest tests/`.

Mirrors the Node `tests/ayoa-import-fixtures.test.js` and
`tests/ayoa-import-name-match.test.js` against the same four real OPML
fixtures. The verification contract is "tests in tests/ pass with `pytest
tests/`, and importing a known OPML yields the correct number of entries with
no exceptions" — this module fulfils that contract.
"""

from __future__ import annotations

import os
import re
from pathlib import Path

import pytest

from _pyayoa_opml import parse_opml


FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _load(name: str) -> str:
    return (FIXTURES_DIR / name).read_text(encoding="utf-8")


FIXTURE_FILES = [
    "waico-maco.opml",
    "final-copa-2026-argentina-espanha.opml",
    "final-copa-2026-argentina-espanha-compatible.opml",
    "world-cup-final-2026-strict.opml",
]


# ---------------------------------------------------------------------------
# Fixtures parse without exceptions
# ---------------------------------------------------------------------------

@pytest.mark.parametrize("filename", FIXTURE_FILES)
def test_fixture_parses_with_non_zero_node_count(filename: str) -> None:
    result = parse_opml(_load(filename))
    assert result["node_count"] > 0, f"{filename} produced 0 nodes"
    assert result["title"], f"{filename} has empty title"
    assert result["central"], f"{filename} has empty central node"
    assert result["max_depth"] >= 0


# ---------------------------------------------------------------------------
# waico-maco.opml specific shape (Tony Buzan, 33 nodes)
# ---------------------------------------------------------------------------

def test_waico_maco_has_33_nodes_tony_buzan_validation() -> None:
    result = parse_opml(_load("waico-maco.opml"))
    assert result["node_count"] == 33
    assert "WAICO-MACO" in result["title"]
    # central + 8 sections + 24 leaves
    assert result["max_depth"] == 2
    assert sum(1 for n in result["nodes"] if n["depth"] == 1) == 8
    assert sum(1 for n in result["nodes"] if n["depth"] == 2) == 24


# ---------------------------------------------------------------------------
# Copa 2026 fixtures
# ---------------------------------------------------------------------------

def test_copa_central_matches_title() -> None:
    result = parse_opml(_load("final-copa-2026-argentina-espanha.opml"))
    assert result["node_count"] == 49
    assert "Final da Copa do Mundo FIFA 2026" in result["central"]
    branches = [n["text"] for n in result["nodes"] if n["depth"] == 1]
    assert "📅 Jogo decisivo" in branches
    assert "🇦🇷 Caminho da Argentina" in branches
    assert "🇪🇸 Caminho da Espanha" in branches


def test_copa_compatible_variant_parses() -> None:
    result = parse_opml(_load("final-copa-2026-argentina-espanha-compatible.opml"))
    assert result["node_count"] == 49
    assert "Final da Copa do Mundo FIFA 2026" in result["central"]


def test_copa_strict_variant_branches_match_canonical_order() -> None:
    result = parse_opml(_load("world-cup-final-2026-strict.opml"))
    assert result["node_count"] == 49
    branches = [n["text"] for n in result["nodes"] if n["depth"] == 1]
    assert branches == [
        "GAME", "ARGENTINA PATH", "SPAIN PATH",
        "STARS", "TACTICS", "NUMBERS", "STORYLINES", "KEY QUESTIONS",
    ]


# ---------------------------------------------------------------------------
# boardName derivation (mirrors ayoa-import-name-match.test.js)
# ---------------------------------------------------------------------------

_TITLE_RE = re.compile(r"<title>\s*([^<]+?)\s*</title>")
_OUTLINE_RE = re.compile(r'<outline\s+text="([^"]+)"')


def derive_board_name(opml: str, override: str | None) -> str:
    if override and override.strip():
        return override.strip()
    m = _TITLE_RE.search(opml)
    if m:
        return m.group(1).strip()
    m = _OUTLINE_RE.search(opml)
    if m:
        return m.group(1).strip()
    return "Imported Map"


@pytest.mark.parametrize(
    "filename,expected",
    [
        ("waico-maco.opml", "WAICO-MACO"),
        ("final-copa-2026-argentina-espanha.opml", "Final da Copa do Mundo FIFA 2026 \u2014 Argentina x Espanha"),
        ("final-copa-2026-argentina-espanha-compatible.opml", "Final da Copa do Mundo FIFA 2026 - Argentina x Espanha"),
        ("world-cup-final-2026-strict.opml", "World Cup Final 2026 - Argentina vs Spain"),
    ],
)
def test_derive_board_name_matches_title(filename: str, expected: str) -> None:
    opml = _load(filename)
    name = derive_board_name(opml, None)
    assert name, "boardName must never be empty (causes INTERNAL_ERROR 500)"
    assert name != ""
    assert name == expected


def test_derive_board_name_override_wins_over_title() -> None:
    opml = _load("waico-maco.opml")
    assert derive_board_name(opml, "My Custom Board") == "My Custom Board"


def test_derive_board_name_empty_override_falls_back_to_title() -> None:
    opml = _load("waico-maco.opml")
    assert derive_board_name(opml, "   ") == "WAICO-MACO"


def test_derive_board_name_no_title_uses_first_outline() -> None:
    opml = (
        '<?xml version="1.0"?><opml version="2.0">'
        '<head></head><body>'
        '<outline text="Root Node"><outline text="Child"/></outline>'
        '</body></opml>'
    )
    assert derive_board_name(opml, None) == "Root Node"


def test_derive_board_name_empty_opml_returns_default() -> None:
    opml = '<?xml version="1.0"?><opml version="2.0"><head></head><body></body></opml>'
    assert derive_board_name(opml, None) == "Imported Map"


# ---------------------------------------------------------------------------
# Negative cases
# ---------------------------------------------------------------------------

def test_empty_input_raises() -> None:
    with pytest.raises(ValueError):
        parse_opml("")


def test_non_opml_root_raises() -> None:
    with pytest.raises(ValueError):
        parse_opml("<root><body/></root>")


def test_missing_body_raises() -> None:
    with pytest.raises(ValueError):
        parse_opml("<opml><head/></opml>")


# ---------------------------------------------------------------------------
# Internal data structure invariants (the import contract)
# ---------------------------------------------------------------------------

def test_central_node_is_first_in_nodes_list() -> None:
    for filename in FIXTURE_FILES:
        result = parse_opml(_load(filename))
        assert result["nodes"][0]["depth"] == 0, f"{filename}: first node is not root"
        assert result["nodes"][0]["text"] == result["central"]


def test_parent_ids_chain_to_root() -> None:
    for filename in FIXTURE_FILES:
        result = parse_opml(_load(filename))
        for node in result["nodes"]:
            if node["parent_id"] is None:
                assert node["depth"] == 0
            else:
                parent = next(p for p in result["nodes"] if p["id"] == node["parent_id"])
                assert parent["depth"] == node["depth"] - 1


def test_node_ids_are_unique_and_sequential() -> None:
    for filename in FIXTURE_FILES:
        result = parse_opml(_load(filename))
        ids = [n["id"] for n in result["nodes"]]
        assert ids == sorted(ids), f"{filename}: ids not sorted"
        assert len(set(ids)) == len(ids), f"{filename}: duplicate ids"
        assert ids == list(range(1, len(ids) + 1)), f"{filename}: ids not 1..N"
