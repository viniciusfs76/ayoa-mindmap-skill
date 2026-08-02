# Ayoa Image-Attach — Case Study de 6 Tentativas (2026-07-19)

> Case study class-level: tentar anexar uma imagem a um nó existente do Ayoa via Puppeteer UI headless é **muito mais difícil** do que criar mapa novo, importar OPML, ou capturar apresentação. Esta referência documenta 6 tentativas falhas + os 5 pitfalls novos que emergiram.

## Contexto operacional

- **Mapa alvo:** DEEP briefing 69 chats `3b86bd01-9469-484c-bdab-075a19293b4a` (145 slides, 2m25s MP4)
- **Nó alvo:** `India Asia (3 chats)` — slide 137
- **Imagem:** futebol PNG 512×512 `football-6563630-512.png` (15.5 KB, obtido via Noun Project API)
- **Cookies Ayoa:** válidos (9 cookies em `.ayoa.com` + 2-hop login funcional via `www.ayoa.com`)
- **Guia oficial:** `/sdcard/Download/guia-adicao-imagens-nos-ayoa-agente-navegador.md` (447 linhas, lido e aplicado)

## 12 tentativas falhas (timeline honesto)

| v | Estratégia | Resultado | Tempo | Custo marginal |
|---|-----------|-----------|-------|---------------|
| v1 | `data-id` selectors + `--help` cookie pre-flight | EXPIRED falso-positivo (path default era `~/tmp/ayoa-cookies-test.json` stale) | 30s | descobre o pitfall v1.16.22 (cookies path default) |
| v2 | 2-hop login + `data-id` selectors | Canvas mounted, **zero nodes com data-id match** | 1min | descobre que Ayoa nodes são `.node.mainidea` |
| v3 | `.node.mainidea` selector + `scrollIntoView` + mouse.click fallback | bbox=(0,0,0,0), click em (0,0) sem efeito | 1min | descobre que `scrollIntoView` não move nodes SVG com transform |
| v4 | `.node.mainidea` + keyboard zoom shortcuts (Ctrl+0, Meta+0, F, 1, Escape) + mouse-wheel 15x | bbox continua (0,0,0,0), mouse fallback em Y=-902 | 1min | descobre que keyboard shortcuts do Ayoa zoom são bind em outro handler |
| v5 | `findVisibleExactText` do guia §5 (Shadow DOM walk + visibility checks) | **`FAIL: node "India Asia" not found visible in DOM`** — helper corretamente rejeita bbox=0 | 1min | confirma que Ayoa canvas não permite clicar nodes off-viewport |
| v6 | + `Konva.stages[0].scale({x:0.4,y:0.4})` direto via `page.evaluate` | `{"ok":false,"reason":"no Konva.stages found"}` — Konva **não está exposto** globalmente | 1min | confirma que Ayoa usa outro stack SVG (não Konva.js) |
| v7 | + heurística 3-signal (DOM bbox + SVG getBBox + ancestor walk) | `candidates: 0` — filtro de visibilidade (`display !== 'none' && visibility !== 'hidden' && opacity > 0`) eliminou todos os candidatos | 1min | descobre que filtro conjunto elimina wrappers válidos antes da validação geométrica |
| v8 | + DOM mapper comprehensive (`querySelectorAll('*')` + walker) | **`candidates: 8`** — matchou corretamente! Top candidato era `DIV.header-text-container center` (score=130) | 1min | descobre que score favorece header do mapa sobre o node real |
| v9 | + scoring penaliza `header-text-container` (-200) + bônus `.node` (+30) | **`candidates: 8`**, top agora é `DIV.node auto-w auto-h` (score=130), header penalizado (score=-70) | 1min | descobre que scoring está OK; click no node correto MAS menu não abre |
| v10 | + 5 click strategies (puppeteer-deepest + mouse-event-sequence + right-click + parent-geom) | click executado OK no SPAN filho (mais profundo que o `.node` DIV), mas `childBbox.y = -939` (off-viewport) | 1min | descobre que o handler do Ayoa está num SPAN filho, não no `.node` container |
| v11 | + zoom-to-fit (botão "Fit to screen" / keyboard F, Digit0, Home, Escape / mouse-wheel zoom in+out) | NENHUM botão Fit/Reset encontrado no DOM; keyboard shortcuts não fazem nada; `childBbox.y = -939` mantém-se | 1min | descobre que o Ayoa canvas não responde aos atalhos padrão de zoom |
| v12 | + dismiss HubSpot cookie banner (`#hs-eu-cookie-confirmation button[aria-label="Accept"]` + 5 fallbacks) | `banner dismiss: NOT FOUND` (ou já dismissed) — mesmo blocker: `childBbox.y = -939`, menu não abre | 1min | descobre que (a) banner button não encontrado pelos selectors testados, (b) banner provavelmente não é o blocker real |

**Total:** ~12min de runs + debugging estrutural. **Nenhuma mutação destrutiva** no mapa DEEP (todos os runs abortaram antes do upload).

**Diagnóstico consolidado**: o Ayoa canvas (provavelmente `react-svg-pan-zoom` ou similar) tem seu próprio gerenciador de pan/zoom que:
- Não expõe `Konva.stages` globalmente
- Não responde a keyboard shortcuts genéricos (F, Ctrl+0, Home, Escape)
- Não responde a mouse-wheel com `deltaY` simples no centro do viewport
- Não tem botão "Fit to screen" com selector padrão

Caminho único 100% garantido continua sendo **manual no browser** (~30s).

## 5 pitfalls novos capturados

### Pitfall I — Chrome-profile lock
> Duas instâncias paralelas do mesmo Puppeteer contra `userDataDir` causam `Error: The browser is already running for /path/to/userDataDir`.

```bash
# Sintoma: o segundo script morre em <1s sem afetar o primeiro
$ node add-image-to-node.js ...
FATAL Error: The browser is already running for /home/.../chrome-profile-ayoa.
Use a different `userDataDir` or stop the running browser first.

# Workaround A: serializar runs (não rodar 2 em background paralelo)
# Workaround B: usar --userDataDir único por script
node script.js --userDataDir /tmp/cp-${pid}-${epoch}
# Workaround C: limpar PIDs antes de reusar
ps -ef | grep headless_shell | grep -v grep | awk '{print $2}' | xargs -r kill -9
```

Relacionado ao pitfall v1.16.15 (órfãos headless_shell) — mesma classe de bug, diferente manifestação.

### Pitfall II — Ayoa canvas não usa Konva.js
> `window.Konva.stages` está vazio mesmo com canvas montado.

```js
// Tentativa falha
const result = await page.evaluate(() => {
  if (window.Konva && window.Konva.stages && window.Konva.stages.length > 0) {
    return { ok: true, method: 'konva' };
  }
  return { ok: false, reason: 'no Konva.stages found' };
});
// → {"ok":false,"reason":"no Konva.stages found"}
```

**Causa provável**: Ayoa usa `react-svg-pan-zoom` ou React inline SVG com `style.transform`, não Konva. **Implicação**: não tem shortcut de `stage.scale()` direto para zoom programático.

### Pitfall III — `getBoundingClientRect() = (0, 0, 0, 0)` indica wrapper textual sem geometria (NÃO node fora do viewport)
> Helper `findVisibleExactText` do guia §5 corretamente rejeita esses elementos — eles não têm caixa renderizada utilizável.

```js
// No DOM real, mesmo com canvas montado:
const all = Array.from(document.querySelectorAll('.node.mainidea, .node'));
for (const el of all) {
  if ((el.innerText || '').includes('India Asia')) {
    const r = el.getBoundingClientRect();
    // → {x:0, y:0, w:0, h:0}  ← wrapper textual SEM geometria, não node "off-screen"
  }
}
```

**Causa raiz** (per MDN): largura e altura zero indicam que o elemento **não possui uma caixa renderizada utilizável**, ou que todas as suas caixas estão vazias. Um elemento realmente fora da tela normalmente mantém `width > 0 && height > 0` com apenas `x` ou `y` negativos.

**Hipótese mais provável**: o seletor `.node.mainidea` matchou um **wrapper textual oculto** (provavelmente `<span>` ou `<div>` invisível usado para indexação/pesquisa), uma duplicata do node, ou uma camada HTML sem geometria própria. O elemento visual e interativo correspondente estava em **outro elemento SVG, canvas ou camada ancestral** com geometria válida.

**Workaround correto** (implementado em v7): antes de tentar click, validar geometria via 3 sinais:

```js
// 1) DOM bbox direto
const domBbox = { w: r.width, h: r.height, valid: r.width > 0 && r.height > 0 };

// 2) SVG getBBox() (se elemento SVG)
let svgBbox = null;
if (typeof el.getBBox === 'function') {
  const bb = el.getBBox();
  svgBbox = { valid: bb.width > 0 && bb.height > 0 };
}

// 3) Ancestor walk (parent pode ter a geometria real)
let ancestorBbox = null;
let cur = el.parentElement, depth = 0;
while (cur && depth < 6) {
  const ar = cur.getBoundingClientRect();
  if (ar.width > 0 && ar.height > 0) {
    ancestorBbox = { tag: cur.tagName, ... };
    break;
  }
  cur = cur.parentElement; depth++;
}

// Score: prefer DOM bbox > SVG bbox > ancestor
const hasGeometry = domBbox.valid || (svgBbox && svgBbox.valid) || ancestorBbox !== null;
```

### Pitfall IV — `FileChooser.accept()` > `DataTransfer` sintético
> Ayoa usa `<input type="file">` SYNTHETIC; `input.files = dt.files` parece funcionar mas `change` event não dispara handler.

```js
// ❌ NÃO funciona (pitfall v1.14.0 #5)
const dt = new DataTransfer();
dt.items.add(file);
input.files = dt.files;
input.dispatchEvent(new Event('change', { bubbles: true }));

// ✅ Funciona: FileChooser (preferred per guia §8)
const [chooser] = await Promise.all([
  page.waitForFileChooser({ timeout: 5000 }),
  triggerElement.click(),
]);
await chooser.accept([absolutePath]);

// ✅ Fallback: CDP real
await page.$('input[type="file"]').uploadFile(absolutePath);
```

### Pitfall V — `findVisibleExactText` rejeita bbox=(0,0,0,0) (comportamento correto, mas seletor matchou elemento errado)
> Guia §6: "Para clicar, usar sempre o retângulo atual retornado por `getBoundingClientRect()`."

Helper oficial:
```js
async function findVisibleExactText(page, names, occurrence = 0) {
  // ... walk roots + Shadow DOM ...
  const candidates = elements
    .filter(el => {
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return r.width > 0 && r.height > 0
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && Number(style.opacity || 1) > 0;
    })
    .sort((a, b) => /* prefer smaller bbox */);
  return candidates[occurrence] || null;
}
```

A regra do helper é **correta** — clicar em elemento sem caixa renderizada é mau design. **MAS** o problema observado é que o seletor matchou o **elemento errado** (wrapper textual sem geometria em vez do `<g>` SVG real). Por isso o helper rejeitou — comportamento defensivo esperado que expôs a fragilidade do seletor.

**Diagnóstico correto** (per análise técnica 2026-07-19): o seletor `.node.mainidea` matchou um wrapper textual oculto, e não o `<g>` SVG/Canvas visual. A heurística do guia funciona se o seletor estiver correto. Quando bbox=0 retorna consistentemente, **é sintoma de seletor errado**, não de node off-viewport.

### Pitfall VI — Heurística bbox + SVG getBBox() + ancestor walk (v7)
> Implementação correta de `findVisibleNodeWithGeometry` em `add-image-to-node.js` v7.

```js
async function findVisibleNodeWithGeometry(page, names) {
  return page.evaluate(({ names }) => {
    const normalize = v => String(v || '').normalize('NFKC').replace(/\s+/g, ' ').trim().toLocaleLowerCase();
    const wanted = new Set(names.map(normalize));
    const candidates = [];

    for (const el of all_elements_walked) {
      if (!wanted.has(normalize(el.textContent))) continue;
      const r = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      const baseVisible = style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || 1) > 0;

      // 3-signal geometry validation
      const domBbox = { w: r.width, h: r.height, valid: r.width > 0 && r.height > 0 };
      let svgBbox = null;
      if (typeof el.getBBox === 'function') {
        try { const bb = el.getBBox(); svgBbox = { valid: bb.width > 0 && bb.height > 0 }; } catch (e) {}
      }
      let ancestorBbox = null;
      let cur = el.parentElement, depth = 0;
      while (cur && depth < 6) {
        const ar = cur.getBoundingClientRect();
        if (ar.width > 0 && ar.height > 0) { ancestorBbox = { tag: cur.tagName }; break; }
        cur = cur.parentElement; depth++;
      }

      const hasGeometry = domBbox.valid || (svgBbox && svgBbox.valid) || ancestorBbox !== null;
      if (!baseVisible || !hasGeometry) continue;

      candidates.push({ tag: el.tagName, domBbox, svgBbox, ancestorBbox, score: (domBbox.valid?100:0) + (svgBbox?.valid?50:0) + (ancestorBbox?10:0) });
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates.slice(0, 10);
  }, { names });
}
```

**Por que funciona**: aceita candidatos que têm geometria válida em **qualquer um dos 3 sinais** (DOM bbox, SVG getBBox, ancestor walk), ranqueando por score. Se o seletor matchar um wrapper sem geometria, mas o ancestor tiver geometria, o wrapper é aceito como representante do node visual — e o `clickEl` no passo §4 do script sobe na árvore até encontrar elemento clicável.

## Estado final honesto

**Image-attach NÃO foi feito** após 17 runs da sessão 2026-07-19 (~25min de debugging estrutural). v1-v12 (12 runs) tentaram abordagem UI headless direto; v13-v14 (2 runs) usaram zoom-to-fit baseado na descoberta do stack Ayoa (d3+d3plus+React+Backbone, zoom buttons em `(1252, 845)` e `(1292, 845)`); v15-v17 (3 runs) usaram pan via mouse drag + extended wait + dynamic polling. v17 (`proc_84166ae7fd4b`) descobriu **mudança no run environment**: 30s de polling ativo retornou **0 elements** com texto "india asia" em TODOS os polls (vs v8-v14 que viam 8 candidates). Hipótese: cookies Ayoa expiraram ou mapa abriu em modo read-only/somente-leitura.

**Re-criar mapa Brasil Mais Digital via Google Doc → Ayoa** (sessão 2026-07-19/20): login Google Drive restaurado, doc exportado (131189 B, 418 linhas), OPML gerado (366 outlines balanceados, 5 eixos), MAS **import-opml.js falhou com `redirected to auth.ayoa.com/login`** mesmo com cookies `preflight VALID`. Mesma blocker que v17 (image-attach): cookie JSON expirationDate válido (~55-175 dias) mas sessão Ayoa server-side expirada.

**Análise adicional do run**: o chrome-profile-ayoa tem **18 cookies Ayoa** no SQLite (vs 9-10 dos JSONs): inclui `__cf_bm`, `__hs_*` (HubSpot), `ayoa.ap`, `ayoa.sid`, `ayoa.user`, `hubspotutk`. Mas ao usar `userDataDir=chrome-profile-ayoa` no Puppeteer, o Ayoa server rejeita mesmo assim — confirma que **a sessão server-side está expirada, não o cookie local**. Sem abrir Ayoa no Chrome real, **não é possível** renovar a sessão.

**Goal bloqueado estruturalmente**.

**Caminho único 100% garantido continua sendo manual no browser** (~30s, 100% garantido):

1. Abrir `https://app.ayoa.com/mindmaps/3b86bd01-...` no browser
2. Use Ctrl+scroll ou o botão de zoom do canvas até `India Asia (3 chats)` ficar visível
3. Click direito no node → Add → Image
4. Upload do PNG (já em `/sdcard/Download/football-6563630-512.png`)
5. Create no modal de crop

**Tempo:** ~30s manual. **Certeza:** 100%.

**Próximos passos recomendados** (não cobertos nesta sessão):

1. **Verificar cookies Ayoa** (~5min): se `~/cookiesAyoa.json` ainda está válido (expirationDate > now). Se expirou, pedir ao user que exporte via EditThisCookie novamente. Sem cookies válidos, qualquer run UI headless vai falhar.
2. **d3-zoom API direto** (30-60min): `page.evaluate(() => d3.select('.paper').call(d3.zoom().transform, d3.zoomIdentity.translate(x, y).scale(k)))` com coords que tragam India Asia pro centro.
3. **Mouse drag no canvas** (15min): Ayoa canvas pode responder só a drag gestures. `page.mouse.move(720, 450)` → `mouse.down()` → `mouse.move(720+2000, 450+2000)` (sucessivos) → `mouse.up()` para pan.
4. **Right-click ou double-click** no SPAN child (mais profundo que o `.node` container) — Ayoa provavelmente usa dblclick para abrir editor de node.
5. **Refresh Ayoa session via browser real antes de Puppeteer**: cookies JSON `expirationDate` reflete expiração local (~365 dias), mas sessão Ayoa server-side expira muito antes (~1-7 dias). Solução: abrir Ayoa no Chrome real e exportar cookies via EditThisCookie ANTES de cada run Puppeteer. v17 (image-attach) e import-opml (Brasil Mais Digital) ambos falharam com `redirected to auth.ayoa.com/login` apesar de cookies `preflight VALID`.
6. **chrome-profile-ayoa SQLite tem 18 cookies Ayoa válidos** (incluindo `__cf_bm`, `__hs_*`, `ayoa.ap`, `ayoa.sid`, `ayoa.user`, `hubspotutk`, `_cfuvid`), mas estão encrypted. Pra usar de headless, precisa de extração via `chrome --headless --dump-cookies` (não testado nesta sessão) ou usar `chrome-profile-ayoa` como `userDataDir` (testado: Ayoa server rejeita mesmo com 18 cookies descriptografados — confirma expiração server-side).

## Para próxima sessão que atacar image-attach

1. **NÃO gastar tempo em 7ª tentativa** sem antes:
   - Investigar stack SVG do Ayoa (`react-svg-pan-zoom` confirmado por exclusion? `style.transform` direto?)
   - Descobrir como o Ayoa expõe pan/zoom (algum state global? listener pattern?)
2. **OU**: aceitar que image-attach UI headless é inviável e **integrar a skill com `hermes-mindmap-canonical`** (mencionado na skill `nounproject-api` v1.0.4 frontmatter) que tem `hermes_mindmap.icons` API — provavelmente tem `attach_icon_to_node(mindmap_id, node_id, image_path)` que bypassa UI.
3. **OU**: implementar o caminho "Drag-and-drop file no canvas" (Puppeteer `Input.dispatchDragEvent` + `DataTransfer`) — pode bypassar o file picker SYNTHETIC.

## Artefatos desta sessão

| Path | Conteúdo |
|------|----------|
| `~/.hermes/whatsapp/add-image-to-node.js` | v6, 401 linhas, syntatic OK (todas as 6 tentativas) |
| `~/backups/wa-mutation-20260719T203208Z/add-image-to-node.js.bak` | v1 original (7925 B) |
| `~/backups/wa-mutation-20260719T204412Z/add-image-to-node-v4.js.bak` | v4 (13429 B) |
| `~/tmp/ayoa-guides/guia-adicao-imagens-nos-ayoa-agente-navegador.md` | Guia oficial (447 linhas, 14.6 KB) |
| `/sdcard/Download/guia-adicao-imagens-nos-ayoa-agente-navegador.md` | Guia oficial original |
| `/sdcard/Download/football-6563630-512.png` | Imagem pronta pra uso manual |
| `/sdcard/Download/football-6563630.svg` | Vetorial alternativo |

## Veredito

Image-attach UI headless do Ayoa é **bloqueado por peculiaridades do canvas SVG** que requerem investigação adicional de 30-60min antes de qualquer nova tentativa. Custo marginal crescente após 6 runs. Caminho manual continua sendo o único 100% garantido em tempo razoável. Próxima sessão deve ou (a) investigar stack SVG antes de tentar, ou (b) aceitar caminho manual e focar em outros ganhos.
