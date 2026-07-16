'use strict';

// lib/opml-parser.js — Pure OPML-to-mind-map structure parser.
//
// Input: valid OPML 2.0 XML string.
// Output: { title, central, nodeCount, maxDepth, nodes, expanded }
//
// Fully testable. No I/O. Uses a robust token-based XML parser for OPML.
// Supports: text, _note, _color, _icon attributes.

function parseOpml(xml) {
  if (typeof xml !== 'string' || !xml.trim()) {
    throw new Error('OPML: input must be a non-empty XML string');
  }

  // Tokenise XML into flat tag/close/text events
  const tokens = tokenise(xml);

  // Build DOM tree
  const root = buildDom(tokens);
  if (!root || root.tag !== 'opml') {
    throw new Error('OPML: root element must be <opml>');
  }

  const head = findChild(root, 'head');
  const bodyParent = findChild(root, 'body');
  if (!bodyParent) throw new Error('OPML: <body> is required');

  const titleEl = findChild(head, 'title');
  const title = titleEl ? textContent(titleEl).trim() : 'Untitled';
  const expansionState = findChild(head, 'expansionState');
  const expanded = expansionState
    ? textContent(expansionState).split(',').map(Number).filter(n => !isNaN(n))
    : [];

  // Build tree from body outlines
  const outlineRoots = bodyParent.children.filter(c => c.tag === 'outline');
  const tree = outlineRoots.map(o => walkOutline(o, 0));

  // Flatten to a list with depth + parentId
  const nodes = [];
  let nextId = 1;
  function flatten(node, depth, parentId) {
    const id = nextId++;
    const flat = {
      id, text: node.text, depth, parentId,
      color: node.color, icon: node.icon, expanded: expanded.includes(id),
    };
    nodes.push(flat);
    for (const child of node.children) {
      flatten(child, depth + 1, id);
    }
  }
  for (const rootNode of tree) {
    flatten(rootNode, 0, 0);
  }

  const maxDepth = nodes.length > 0 ? Math.max(...nodes.map(n => n.depth)) : 0;

  return {
    title: title,
    central: nodes[0]?.text || '',
    nodeCount: nodes.length,
    maxDepth,
    nodes,
    expanded,
  };
}

function walkOutline(el, depth) {
  const text = el.attrs.text || el.attrs._text || '';
  const color = el.attrs._color || el.attrs.color || null;
  const icon = el.attrs._icon || el.attrs.icon || null;
  const children = el.children
    .filter(c => c.tag === 'outline')
    .map(c => walkOutline(c, depth + 1));
  return { text, color, icon, depth, children };
}

// — token-based XML parser —
// Produces an array of events: { type: 'open'|'close'|'text', tag?, attrs?, content? }

function tokenise(xml) {
  const tokens = [];
  // Remove XML declaration and comments
  let clean = xml.replace(/<\?[^>]+\?>|<!--[\s\S]*?-->/g, '').trim();

  // Tokenise: match tag or text. Use matchAll for proper non-g behaviour.
  const re = /<(\/?)(\w[\w-]*)((?:\s+\w[\w-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/;
  let lastIndex = 0;

  // Use exec manually with proper lastIndex tracking
  const execRe = new RegExp(re.source, 'g');
  let m;
  while ((m = execRe.exec(clean)) !== null) {
    if (m.index > lastIndex) {
      const text = clean.slice(lastIndex, m.index).trim();
      if (text) tokens.push({ type: 'text', content: text });
    }
    lastIndex = m.index + m[0].length;

    const isClose = m[1] === '/';
    const tag = m[2];
    const attrsRaw = m[3];
    const isSelfClose = m[4] === '/';

    if (isClose) {
      tokens.push({ type: 'close', tag });
    } else {
      const attrs = {};
      const attrRe = /(\w[\w-]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|(\S+))/g;
      let am;
      while ((am = attrRe.exec(attrsRaw)) !== null) {
        attrs[am[1]] = am[2] !== undefined ? am[2] : (am[3] !== undefined ? am[3] : am[4]);
      }
      tokens.push({ type: 'open', tag, attrs });
      if (isSelfClose) {
        tokens.push({ type: 'close', tag });
      }
    }
  }

  return tokens;
}

// — build DOM tree from token list —
function buildDom(tokens) {
  const stack = [];
  let root = null;

  for (const tok of tokens) {
    if (tok.type === 'open') {
      const el = { tag: tok.tag, attrs: tok.attrs || {}, children: [], content: '' };
      if (stack.length > 0) {
        stack[stack.length - 1].children.push(el);
      } else {
        root = el;
      }
      stack.push(el);
    } else if (tok.type === 'close') {
      if (stack.length === 0) {
        throw new Error(`OPML: unexpected closing tag </${tok.tag}>`);
      }
      const top = stack[stack.length - 1];
      if (top.tag !== tok.tag) {
        throw new Error(`OPML: tag mismatch </${tok.tag}> (expected </${top.tag}>)`);
      }
      stack.pop();
    } else if (tok.type === 'text') {
      if (stack.length > 0) {
        stack[stack.length - 1].content += tok.content;
      }
    }
  }

  if (stack.length > 0) {
    throw new Error(`OPML: unclosed tag <${stack[0].tag}>`);
  }

  return root;
}

function findChild(parent, tagName) {
  if (!parent || !parent.children) return null;
  return parent.children.find(c => c.tag === tagName) || null;
}

function textContent(el) {
  if (!el) return '';
  if (el.children.length > 0) {
    return el.children.map(c => textContent(c)).join('');
  }
  return el.content || '';
}

module.exports = { parseOpml, tokenise, buildDom, walkOutline, findChild, textContent };
