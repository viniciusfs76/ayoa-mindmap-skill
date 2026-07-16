"""Pure-Python OPML 2.0 parser.

Mirrors `scripts/lib/opml-parser.js` so the Ayoa OPML import path has a Python
verifier that the standard `pytest tests/` discovery can execute. No third-party
dependencies — only `xml.etree.ElementTree` from stdlib, plus a tolerant pre-pass
that strips XML declarations and comments before parsing.

Public surface:

    parse_opml(text) -> {
        "title": str,
        "central": str,
        "node_count": int,
        "max_depth": int,
        "nodes": [{"id": int, "text": str, "depth": int, "parent_id": int | None}, ...],
        "expanded": list[int],
    }

The output is intentionally identical in shape to the Node parser so the JS and
Python suites can share the same regression fixtures (`tests/fixtures/*.opml`).
"""

from __future__ import annotations

import re
from typing import Any

from xml.etree import ElementTree as ET


_XML_DECL = re.compile(r"<\?xml[^?]*\?>")
_COMMENT = re.compile(r"<!--.*?-->", flags=re.DOTALL)


def _strip_prolog(text: str) -> str:
    cleaned = _XML_DECL.sub("", text)
    cleaned = _COMMENT.sub("", cleaned)
    return cleaned.strip()


def parse_opml(text: str) -> dict[str, Any]:
    if not isinstance(text, str) or not text.strip():
        raise ValueError("OPML: input must be a non-empty XML string")

    cleaned = _strip_prolog(text)
    try:
        root = ET.fromstring(cleaned)
    except ET.ParseError as exc:
        raise ValueError(f"OPML: malformed XML ({exc})") from exc

    if (root.tag or "").lower() != "opml":
        raise ValueError("OPML: root element must be <opml>")

    head = None
    body = None
    for child in list(root):
        tag = (child.tag or "").lower()
        if tag == "head" and head is None:
            head = child
        elif tag == "body" and body is None:
            body = child
    if body is None:
        raise ValueError("OPML: <body> is required")

    title_text = "Untitled"
    expanded: list[int] = []
    if head is not None:
        for child in list(head):
            tag = (child.tag or "").lower()
            if tag == "title" and (child.text or "").strip():
                title_text = (child.text or "").strip()
            elif tag == "expansionstate" and (child.text or "").strip():
                try:
                    expanded = [int(p) for p in (child.text or "").split(",") if p.strip().lstrip("-").isdigit()]
                except ValueError:
                    expanded = []

    nodes: list[dict[str, Any]] = []
    next_id = 1

    def walk(outline: ET.Element, depth: int, parent_id: int | None) -> None:
        nonlocal next_id
        node_id = next_id
        next_id += 1
        text = outline.attrib.get("text") or outline.attrib.get("_text") or ""
        nodes.append({
            "id": node_id,
            "text": text,
            "depth": depth,
            "parent_id": parent_id,
            "color": outline.attrib.get("_color") or outline.attrib.get("color"),
            "icon": outline.attrib.get("_icon") or outline.attrib.get("icon"),
            "expanded": node_id in expanded,
        })
        for child in list(outline):
            if (child.tag or "").lower() == "outline":
                walk(child, depth + 1, node_id)

    for child in list(body):
        if (child.tag or "").lower() == "outline":
            walk(child, 0, None)

    max_depth = max((n["depth"] for n in nodes), default=0)
    return {
        "title": title_text,
        "central": nodes[0]["text"] if nodes else "",
        "node_count": len(nodes),
        "max_depth": max_depth,
        "nodes": nodes,
        "expanded": expanded,
    }
