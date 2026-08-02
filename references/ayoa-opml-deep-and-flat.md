# Ayoa OPML — Deep vs Flat Tree Patterns

Skill-level **pattern** for generating OPML mind maps from a Google Doc
canonical source when the user asks for "mapa com bastante profundidade"
(deep tree) or "nó intermediário único eliminado" (flat tree). Both
classes have appeared in the IPD de VCs workspace and recur.

## When to use

The user issues one of these phrases in Portuguese or English:

- "mapa com bastante profundidade" / "deep tree" / "5 níveis" / "maxDepth >= 5"
- "nó intermediário único" / "promote to level N" / "flat tree"
- "folha profunda" / "depth 5 or 6"

The numeric depth needed is documented in `references/ayoa-end-to-end-drive-to-mp4.md`:
40-70 nós precisa de ~2m de vídeo a 1 fps. Going beyond 200 nós hits
the Ayoa Web cap (480 nodes per map observed in 2026-07).

## Deep tree pattern (4 levels between root and leaves)

Target shape: `raiz → 4 ramos → 8-12 sub-ramos → 20-30 sub-sub-ramos → 50+ folhas`.

Used when the source document has a Tony Buzan / Buzan-mind-map flavor
with named "Ramificações" and "Eixos" sections. Empirical case 2026-07-16
(Portaria IPD Minuta Canonica v0.5): 4 ramos × 3 sub-ramos × 4 sub-sub-ramos
× 3-5 folhas = 122-130 nós. Produces a fan-out map where each branch
explores a different dimension of the topic.

```xml
<outline text="01 Decisao de Arquitetura">
  <outline text="01.1 Premissa">
    <outline text="01.1.1 Solucao intermediaria">
      <outline text="01.1.1.1 Reaproveitar garimpo historico">
        <outline text="Fases 0 a 183 - 6 meses de evidencia"/>
        <outline text="Reducao de risco de re-trabalho estrutural"/>
      </outline>
    </outline>
  </outline>
</outline>
```

The deep tree corresponds to the user's literal description of the doc
hierarchy. Do NOT collapse levels when the user asks for "bastante
profundidade" — they explicitly want a 5-level map.

## Flat tree pattern (1 level between root and leaves)

Target shape: `raiz → 4 ramos → 11+ sub-ramos → 20+ sub-sub-ramos → 35+ folhas`.

Used when the user wants each named section of the source doc to be a
**direct child of the central node**. The "nó intermediário único"
request means: if the original document has a section like "1.
Decisão de Arquitetura" containing a sub-section "1.1 Premissa"
containing a sub-sub "1.1.1 Solução intermediária", the user wants
"Solução intermediária" promoted to be a direct child of "1. Decisão
de Arquitetura" — the "Premissa" intermediate is deleted.

```xml
<!-- after flat pattern -->
<outline text="01 Decisao de Arquitetura">
  <outline text="01.1 Solucao intermediaria">   <!-- was 01.1.1, promoted -->
    <outline text="01.1.1 Reaproveitar garimpo historico">  <!-- was 01.1.1.1 -->
      <outline text="Fases 0 a 183 - 6 meses de evidencia"/>
      <outline text="Reducao de risco de re-trabalho estrutural"/>
    </outline>
    <outline text="01.1.2 Eixos qualitativos ampliam o corpo">
      <outline text="Privacidade tratada como classe de primeira ordem"/>
    </outline>
  </outline>
</outline>
```

Note the renumbering: when promoting `01.1.1` to `01.1`, all children
that were `01.1.1.N` become `01.1.N` and grandchildren that were
`01.1.1.N.M` become `01.1.N.M`. The depth-2 prefix is now the "stable
parent" that gets all the leaves.

## Empirical depth distribution

When the source doc has N top-level sections each with M subsections
each with P sub-subsections each with Q leaves:

| Pattern | Total nodes | Depth |
|---|---|---|
| Deep (4 levels) | 1 + N + N×M + N×M×P + N×M×P×Q | up to 6 |
| Flat (1 level promotion) | 1 + N + N×M×P + N×M×P×Q | up to 5 |

For the IPD minuta (4 sections, 3 sub, 3-4 sub-sub, 2-4 leaves):

- Deep: 1 + 4 + 12 + 36 + 70 = 123 nodes, maxDepth 6.
- Flat: 1 + 4 + 36 + 70 = 111-123 nodes, maxDepth 5.

The flat pattern is **denser in level 2** (more direct children of the
central node) and **shallower overall**. The user almost always wants
flat when the document already has a clear section/sub-section
hierarchy.

## How to decide

Ask once, briefly, only if the request is ambiguous:

- "com bastante profundidade" / "5 níveis" / "deep tree" → deep
- "nó intermediário único" / "promote" / "flat tree" → flat
- both at once → flat (it's the more aggressive interpretation; user
  can ask for the deep version after)

If the user does not specify, default to deep (the historical default
since v1.16.2) and capture the pattern in the OPML header comment so
the next session can re-flat if needed.

## Generation script template

```js
const fs = require('fs');

// 1. Walk the source Doc (extracted text) and identify section headings.
const sections = parseMarkdownHeadings(docText);
// Each section becomes an <outline text="..."> at the appropriate depth.

// 2. For deep: keep the original section -> subsection -> subsubsection nesting.
//    For flat: walk the tree and emit the depth-3 node as a direct child
//    of the depth-1 root, with the depth-2 prefix stripped.

function buildOpml(sections, { pattern = 'deep' } = {}) {
  // pattern === 'deep': emit each heading as <outline text="<heading>"> at its
  //   original depth.
  // pattern === 'flat': walk the tree, drop every depth-2 node, reparent
  //   its children to the corresponding depth-1 node, with the depth-3
  //   prefix renumbered to depth-2.
}
```

The flat-pattern renumbering is the only non-trivial part. Use a
post-order walk: collect `(section, depth)` tuples, then for each
depth-3 tuple, look up its depth-2 parent, drop the depth-2, and
attach the depth-3 directly to the depth-1 ancestor. Renumber the
prefixes using a depth-aware regex.

## Validation in tests

The deep tree test (`tests/ayoa-deep-tree.test.js`, 3 cases) and flat
tree test (no separate file yet) should both check:

1. `nodeCount >= 50` (minimum for "many nodes").
2. `maxDepth >= 5` (always satisfy the user's depth requirement).
3. `byDepth[1] === 4` (4 top-level branches) for the IPD canonica.
4. `byDepth[2]` count: deep pattern expects ~8, flat expects ~11+.
5. Both Node and Python parsers produce the same shape (cross-parser
   invariant).

## Worked example

Source doc: `1aqiDzzsNrwrW6jPlgM7fUcw6s3w0mEtZRE0FwvSab_A` (Portaria IPD
Minuta Canonica v0.5, modifTime 2026-07-14). Section structure:
- 4 sections (Decisão de Arquitetura, Principais Incorporações,
  Anexo I Estruturado, Salvaguardas Preservadas)
- 8 subsections total
- 30 sub-subsections total
- 70 leaves

Deep pattern (v1.16.4 import of `portaria-ipd-v05-deep.opml`):
- 1 + 4 + 8 + 30 + 70 = 123 nodes
- maxDepth = 6
- byDepth = {0: 1, 1: 4, 2: 8, 3: 15, 4: 26, 5: 49, 6: 20}
- Generated mindmap id: `dbe1a035-282c-4090-9948-914baebc9bd5`
- Video: 124 slides, 3.8 MB, 2m04s.

Flat pattern (v1.16.6 import of `portaria-ipd-v05-flat.opml`):
- 1 + 4 + 11 + 20 + 35 + 51 = 122 nodes
- maxDepth = 5
- byDepth = {0: 1, 1: 4, 2: 11, 3: 20, 4: 35, 5: 51}
- Generated mindmap id: `56355169-a2a0-456d-8802-63b9184c10ab`
- Video: 123 slides, 3.7 MB, 2m03s.

The visual difference is the level-2 row: deep has 8 wide sub-branches
off each of the 4 main branches; flat has 11 sub-branches packed
directly into the 4 main branches.
