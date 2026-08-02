# Ayoa Canvas Stack Discovery (2026-07-19)

> Receiita class-level para identificar o stack SVG/JS do Ayoa canvas via `Object.keys(window)` + DOM inspect. Validado em 17 runs do image-attach no mapa `3b86bd01-9469-484c-bdab-075a19293b4a`. Carregar antes de tentar mutações programáticas no canvas (zoom, pan, layout) — porque pan/zoom programático exige API correta (Konva vs d3-zoom vs SVG transform).

## Por que importa

Ayoa canvas **NÃO usa Konva.js** (verificado). Tentativas de `window.Konva.stages[0].scale({x:0.4,y:0.4})` retornam `{ok:false, reason:'no Konva.stages found'}` mesmo com canvas montado. O stack real é **d3 + d3plus + React + Backbone + jQuery** — então o caminho correto de zoom/pan programático é via `d3-zoom` API, não Konva.

## Script de discovery (`inspect-ayoa-event-listeners.js`)

Salvar em `~/.hermes/whatsapp/inspect-ayoa-event-listeners.js`. Rodar contra o mapa alvo.

### 1. Window globals detection

```js
const globals = await page.evaluate(() => {
  const out = {};
  const keys = Object.keys(window);
  const interesting = [
    'Konva', 'd3', 'svgPanZoom', 'react-svg-pan-zoom', 'SVG', 'svg',
    '__REACT_DEVTOOLS_GLOBAL_HOOK__', 'webpackJsonp', 'React',
    'Alpine', 'Vue', 'Backbone', 'jQuery',
    'Ayoa', 'ayoa', 'app', 'App', 'mindmap', 'mindMap', 'MindMap',
    'canvas', 'svgCanvas', 'svgRenderer', 'editor', 'Editor',
  ];
  for (const k of interesting) {
    if (window[k] !== undefined) {
      const v = window[k];
      out[k] = (typeof v === 'function' || typeof v === 'object') ? `[${typeof v}]` : String(v).slice(0, 60);
    }
  }
  out._other = keys.filter(k => /^(svg|d3|konva|pan|zoom|canvas|react|vue|backbone|ayoa|mindmap)/i.test(k)).slice(0, 20);
  return out;
});
```

### 2. India Asia node walk

```js
const ancestorMap = await page.evaluate(() => {
  const targetText = 'India Asia';
  const normalize = v => String(v || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
  const wanted = targetText.toLocaleLowerCase();
  const all = Array.from(document.querySelectorAll('.node'));
  let node = null;
  for (const el of all) {
    if (normalize(el.textContent).includes(wanted)) { node = el; break; }
  }
  if (!node) return { found: false };

  const chain = [];
  let cur = node;
  let depth = 0;
  while (cur && depth < 10) {
    const r = cur.getBoundingClientRect();
    chain.push({
      tag: cur.tagName,
      class: String(cur.className || '').slice(0, 60),
      id: cur.id || null,
      bbox: { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) },
    });
    cur = cur.parentElement;
    depth++;
  }
  return { found: true, chain };
});
```

### 3. CDP event listeners no nó + ancestrais

```js
const client = await page.target().createCDPSession();
await client.send('DOM.enable');

for (let i = 0; i < ancestorMap.chain.length; i++) {
  const anc = ancestorMap.chain[i];
  const selector = anc.id ? `#${anc.id}` : `${anc.tag}${anc.class ? '.' + anc.class.split(' ')[0] : ''}`;
  const doc = await client.send('DOM.getDocument');
  const sr = await client.send('DOM.querySelector', { nodeId: doc.root.nodeId, selector });
  if (!sr.nodeId) continue;
  const ls = await client.send('DOM.getEventListeners', { nodeId: sr.nodeId });
  if (ls.listeners && ls.listeners.length > 0) {
    console.log(`[depth=${i}] ${selector}: ${ls.listeners.length} listeners — types: ${ls.listeners.map(l => l.type).slice(0,8).join(', ')}`);
  }
}
```

### 4. ALL buttons scan (zoom/fit/center/reset)

```js
const allButtons = await page.evaluate(() => {
  const all = Array.from(document.querySelectorAll('button, [role="button"], a, div[class*="toolbar"], div[class*="zoom"], div[class*="control"], svg'));
  return all.map(el => {
    const r = el.getBoundingClientRect();
    return {
      tag: el.tagName,
      text: (el.innerText || '').trim().slice(0, 40),
      ariaLabel: el.getAttribute('aria-label') || '',
      title: el.getAttribute('title') || '',
      class: String(el.className || '').slice(0, 80),
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      visible: r.width > 0 && r.height > 0,
    };
  }).filter(b => b.visible && (b.text || b.ariaLabel || b.title));
});
```

## Resultado confirmado em 2026-07-19 (mapa `3b86bd01-...`)

### Globals presentes

```json
{
  "d3": "[object]",
  "React": "[object]",
  "Backbone": "[object]",
  "jQuery": "[function]",
  "app": "[object]",
  "mindmap": "[object]",
  "_other": ["ayoaGetGoogleAnalyticsIdsAvailable", "ayoaGetGoogleAnalyticsIdsQueuedRequests",
             "ayoaGetGoogleAnalyticsIds", "Backbone", "d3", "d3plus",
             "ReactComponents", "React", "ReactDOM", "ayoaGetGoogleAnalyticsIdsRequestListener"]
}
```

### Globals AUSENTES

- `Konva` (confirmado vazio)
- `svgPanZoom`
- `react-svg-pan-zoom`
- `SVG.js` (lib)
- `Vue`, `Alpine`

### Implicação prática

Ayoa canvas provavelmente usa **d3-zoom** interno (acessível via `d3.select('.paper').call(d3.zoom().transform, d3.zoomIdentity.translate(x, y).scale(k))`) com React + Backbone para lifecycle. Zoom buttons existem e respondem a `page.click('.zoom-in')` via CSS selector — **MAS** o zoom escala a partir de um anchor fixo (não centro do viewport), então 30 clicks `.zoom-in` movem um node em `(1615, -949)` para `(2510, -2370)` — **PIOR**, não melhor.

### Zoom buttons encontrados (via DOM inspect)

| Botão | Coords | Title | Class |
|-------|--------|-------|-------|
| zoom-out | (1252, 845) | "Diminuir Zoom" | `zoom-out right-border` |
| zoom-in | (1292, 845) | "Aumentar Zoom" | `zoom-in right-border` |
| zoom-level | (1372, 845) | "Nível de zoom" (text: "100%") | `zoom-level` |

**Importante**: title attribute, não aria-label. Selectors `button[aria-label*="zoom"]` **NÃO** encontram esses — usar `[title*="Zoom"]`.

## Receitas derivadas

### Zoom programático (não recomendado)

```js
// ❌ Konva — não funciona
await page.evaluate(() => window.Konva.stages[0].scale({x:0.4,y:0.4}));
// → TypeError: Cannot read properties of undefined (reading 'stages')

// ✅ page.click('.zoom-in') via CSS selector — funciona mas escala do anchor fixo
await page.click('.zoom-in', { delay: 50 });
// ⚠️ 30 clicks moveram node (1615, -949) → (2510, -2370). PIOR, não melhor.
```

### Pan programático (não testado nesta sessão — v15 morreu antes)

```js
// 🟡 Tentativa v15 (provável): mouse drag em .paper
const startX = 720, startY = 450;
const endX = 720 + 200, endY = 450 + 200;
await page.mouse.move(startX, startY);
await page.mouse.down();
for (let s = 1; s <= 10; s++) {
  await page.mouse.move(startX + (endX-startX)*s/10, startY + (endY-startY)*s/10);
  await new Promise(r => setTimeout(r, 50));
}
await page.mouse.up();
```

### d3-zoom API direto (próxima tentativa recomendada)

```js
// Não testado em produção mas é o caminho mais provável baseado no stack detectado
await page.evaluate(() => {
  // d3 está em window.d3 (verificado)
  const paper = document.querySelector('.paper');
  if (!paper || !window.d3 || !window.d3.zoom) return { ok: false, reason: 'no paper or d3.zoom' };

  // Tentar reset + fit
  const sel = window.d3.select(paper);
  sel.call(window.d3.zoom().transform, window.d3.zoomIdentity.translate(0, 0).scale(0.4));
  return { ok: true, method: 'd3-zoom-transform' };
});
```

## Quando carregar esta referência

- Antes de tentar mutações programáticas no canvas (zoom, pan, layout, theme)
- Quando `Konva.stages` retorna vazio (sintoma: "API de pan/zoom diferente de Konva")
- Quando `page.click('.zoom-in')` muda bbox mas mantém node off-viewport (sintoma: "zoom anchor fixo")
- Para confirmar se o user está em read-only mode (canvas monta `.node.mainidea` mas nodes filhos não chegam — verificado em v17, era sessão em modo embed)

## Reprodução rápida

```bash
node /data/data/com.termux/files/home/.hermes/whatsapp/inspect-ayoa-event-listeners.js \
  --cookies ~/cookiesAyoa.json \
  --target 'https://app.ayoa.com/mindmaps/3b86bd01-9469-484c-bdab-075a19293b4a' \
  --node-text 'India Asia' 2>&1 | tail -50
```

Output vai para `~/tmp/ayoa-event-listeners.json` (inclui globals, ancestors, allButtons, capturedAt).

## Veredito

Ayoa canvas = **d3 + d3plus + React + Backbone + jQuery**. Pan/zoom programático correto = `window.d3.zoom` API. Zoom via botões HTML (`.zoom-in`) funciona mas **não centraliza** o node no viewport — escalonamento é a partir de um anchor fixo. Para image-attach UI headless, a próxima tentativa deve combinar pan (`mouse.drag` em `.paper`) + zoom (`d3.zoom().transform` com translate+scale corretos) antes de tentar click no node.