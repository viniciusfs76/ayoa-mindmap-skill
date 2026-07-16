# Pitfalls conhecidas do Ayoa (verificado: 2026-07-16)

## Captura de slides (Puppeteer no Ayoa, 2026-07-16)

### Cliques no item da lista do Present não movem o canvas
- **Sintoma:** `ayoa-capture-slides.js` produz N PNGs onde `slide-001.png == slide-002.png == ... == slide-NNN.png`. Todos mostram o slide 1 estático, com pequenas variações de zoom/pan.
- **Causa:** o Ayoa Web tem **dois controles de navegação** que o usuário usa intuitivamente: a **lista lateral** (`.slides-list-group-item`) e a **seta Next** (`.slides-nav-container > :last-child`). A lista só **seleciona** o item (muda a marca `selected`); a seta Next é o que **avança** o canvas de apresentação. `navigateToSlide(page, id)` chamando `el.scrollIntoView + dispatchEvent('click')` no `<li>` muda o `selected` mas não move o canvas.
- **Diagnóstico rápido:** inspecione `slide-001.png` e `slide-002.png` lado a lado. Se forem idênticos, é este bug.
- **Fix:** `ayoa-presenter.js` expõe `goToSlideForCapture(page, slideId)` que orquestra: `enterPresentationMode` (clica `.slides-play-stop-button` até `.presenting`) → `navigateToSlide` (clica o `<li>` para selecionar) → wait `activeId === slideId && panel.presenting === true` → `sleep(WAIT_MS)` → screenshot. Se `settled: false`, fallback para `advanceToSlideViaNextArrow` que clica a seta Next até casar.
- **Regra geral:** **a screenshot só é válida depois de `activeId === expectedId && presenting === true`**, nunca antes. Validar os dois predicados em loop, com timeout, é a regra. Aplica-se a qualquer apresentador web (PowerPoint Online, Google Slides, Notion slides, Ayoa).

### Slides estáticos: a screenshot captura o canvas do editor, não do apresentador
- **Sintoma:** todos os `slide-NNN.png` saem com o mesmo conteúdo (o canvas do editor com o mapa estático, não o canvas de apresentador com o slide desenhado).
- **Causa:** se `enterPresentationMode` falhou silenciosamente (ex: o button `slides-play-stop-button` ainda não montou), o `panel.classList.contains('presenting')` fica `false` e o screenshot é do editor. O `navigateToSlide` ainda muda o `selected` na lista lateral, dando a **falsa impressão** de que está funcionando.
- **Diagnóstico:** inspecionar `slide-001.png`. Se o screenshot tem as **toolbars de edição** e o canvas é o canvas do mapa (não do apresentador), é este bug.
- **Fix:** `goToSlideForCapture` valida `panel.presenting === true` como pré-condição, e o Ayoa tem a classe `presenting` na `.slides-list-container` (e na `.slides-play-stop-button` como `selected`) apenas quando o usuário clicou Play. Sem essa classe, **não capturar**.

## Puppeteer + headless + fixtures (genérico, class-level)

### `page.evaluate` não serializa closures
- **Sintoma:** `ReferenceError: x is not defined` dentro de `page.evaluate(() => ...)` quando `x` é uma closure ou variável Node.
- **Causa:** `page.evaluate(predicate, argument)` envia apenas o **valor** de `argument` ao contexto da página; o `predicate` não enxerga o escopo do chamador. Closures, Promises, símbolos, WeakMap, Map/Set com chaves de objeto: **não são serializáveis** por padrão.
- **Fix:** Capture o valor em const local antes e passe explicitamente:
  ```js
  const expected = created.slideCount;
  await page.evaluate((n) => document.querySelectorAll('.x').length === n, expected);
  ```
  Para objetos complexos, retorne um objeto serializável do Node e use-o após a `await`:
  ```js
  const { ok, count } = await page.evaluate(() => ({ ok: Boolean(predicate()), count: els.length }));
  ```
- NUNCA `page.evaluate(() => fn(x))` onde `fn` é uma função Node — vai para o contexto da página como `undefined`.

### `dispatchEvent` só aciona handlers do próprio elemento
- **Sintoma:** `MouseEvent` disparado em um elemento pai não roda o handler do descendente; ou vice-versa. Em testes, parece "o popper do menu não abre".
- **Causa:** `el.dispatchEvent(new MouseEvent('click', { bubbles: true }))` chama apenas handlers **registrados no próprio `el`**. O `bubbles: true` afeta o caminho da propagação no DOM real, mas em fixture sintética o evento só é entregue ao `target` original.
- **Fix:** Adicione o handler diretamente no elemento que recebe o `dispatchEvent`; ou dispare também o evento no descendente que tem o handler. Em testes com menu popper, sempre registrar handler no **mesmo nó** que recebe o `dispatchEvent` sintético.

### Fixture precisa simular o que a UI real mostra após cada ação
- **Sintoma:** Teste que faz `Clear all` espera o botão **Auto-create** reaparecer, mas `autoCreatePresentation` falha com `no-auto-create`.
- **Causa:** O Ayoa renderiza `.slides-list-empty` quando o deck zera; o fixture antigo não recriava esse nó após a limpeza.
- **Fix:** No handler simulado de `Clear all`, recrie `.slides-list-empty` com o botão **Auto-create** (em PT-BR e EN) para emular a UX real. Generalize: todo handler de teste deve reproduzir **toda** a mutação que a UI real faria após a ação correspondente.

### `package.json` precisa de um `test` real
- **Sintoma:** `npm test` falha com `Error: no test specified` (exit 1) mesmo quando `node --test` passa.
- **Causa:** O `package.json` da skill veio com o placeholder `"test": "echo \"Error: no test specified\" && exit 1"` (template de `npm init -y`).
- **Fix:** Defina `"test": "node --test <files>..."` apontando para a suíte canônica; adicione runners por arquivo (`test:login`, `test:present-mode`, ...) para diagnóstico. Sem isso, `npm test` não detecta regressão e o guardrail fica cego. Aplique em qualquer skill com `node --test`.

## OPML import no Ayoa (Puppeteer headless, 2026-07-15)

### Ayoa SPA monta nós em Shadow DOM / custom elements (canvas não expõe `contenteditable`)
- **Sintoma:** `waitForSelector('[contenteditable="true"], .mind-map-node, [data-testid="central-node"], text/Central')` expira após 30s quando o Ayoa cria novo mapa.
- **Causa:** o canvas do Ayoa monta nodes via Shadow DOM ou elementos custom que os seletores CSS padrão não enxergam. Mesmo com login OK, o selector não casa.
- **Fix (1ª linha):** gerar OPML via skill (`google-drive` ou parser próprio) e pedir ao user para importar manualmente pelo UI (passos 1–3 em `references/ayoa-opml-agent-manual.md`). O `import-opml-v3.js` captura screenshot diagnóstico em `~/.ayoa-import-opml-v3-{1,2,3,4}.png` para confirmar.
- **Fix (2ª linha):** se a sonda headless for mandatória, monitorar apenas a **URL** mudar para `https://app.ayoa.com/mindmaps/<new-uuid>` — esse é o sinal de sucesso do Passo 3. A renderização interna é responsabilidade da Ayoa, fora do scope do Puppeteer.

### `page.setCookie` rejeita cookies com campos malformados (`Protocol error: Invalid cookie fields`)
- **Sintoma:** ao injetar cookies exportados do navegador Android (EditThisCookie → JSON, ~1800 cookies), `page.setCookie(...)` em massa falha com `Protocol error (Network.setCookies): Invalid cookie fields`. Em bulk, o Puppeteer aborta no primeiro cookie inválido.
- **Causa:** o Puppeteer (CDP `Network.setCookies`) é estrito: aceita apenas `sameSite` ∈ {Lax, Strict, None} (não `unspecified`); exige `domain` não-vazio, `name` e `value` strings. Cookies com `sameSite: 'unspecified'` (formato padrão do EditThisCookie), `priority` faltando, ou `hostOnly: undefined` são rejeitados.
- **Fix:** filtrar ANTES de injetar e, mesmo após filtrar, injetar **um por um** para que um cookie ruim não aborte o lote:
  ```js
  const valid = cookies
    .map(c => {
      const ss = c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax');
      if (!['Lax','Strict','None'].includes(ss)) return null;
      if (!c.name || !c.value || !c.domain) return null;
      return {
        name: String(c.name),
        value: String(c.value),
        domain: c.domain.startsWith('.') ? c.domain : '.' + c.domain,
        path: String(c.path || '/'),
        httpOnly: Boolean(c.httpOnly),
        secure: Boolean(secure),
        sameSite: ss,
      };
    })
    .filter(Boolean);
  let injected = 0;
  for (const ck of valid) {
    try { await page.setCookie(ck); injected++; }
    catch (e) { console.log(`skipped ${ck.name}: ${e.message}`); }
  }
  ```
- **Regra:** EditThisCookie sempre exporta `sameSite: 'unspecified'` para cookies sem SameSite explícito. Esperar 5–20% de cookies pulados em qualquer export.

### `__Host-*` cookies são rejeitados pelo Puppeteer sem warning
- **Sintoma:** ao injetar cookies de `Pictures/cookies.json` (Android) que incluem `__Host-LV`, `__Host-stack-refresh-...`, `__Host-LinkSession`, `__Host-MSAAUTHP`, `__Host-1PLSID`, `__Host-3PLSID`, `__Host-GAPS`, `__Host-user_session_same_site` — todos retornam `Invalid cookie fields`.
- **Causa:** cookies com prefixo `__Host-` exigem `Secure=true` E `Path=/` (especificação RFC 6265bis). O Puppeteer valida esses invariantes e rejeita mesmo quando o cookie é válido pelo browser. Em headless sem HTTPS, a rejeição é silenciosa.
- **Fix:** registrar `skipped` no log e seguir; **esses cookies não são injetáveis via Puppeteer headless**, mas a sessão Ayoa continua funcionando porque o Ayoa valida o token do cookie já presente. Se a autenticação falhar, o problema NÃO é a falta dos `__Host-*`, é a falta dos `ayoa.ap`/`ayoa.sid`/`ayoa.user` (que **são** injetáveis).
- **Diagnóstico rápido:** se a URL final do flow for `https://auth.ayoa.com/login?continue=...` mesmo com 1800+ cookies injetados, o problema é **sessão Ayoa ausente**, não cookies `__Host-*` faltando. Focar em validar `ayoa.ap`/`ayoa.sid`/`ayoa.user` no JSON exportado.

### Frame detach ao navegar após `setCookie` em Ayoa SPA
- **Sintoma:** após `page.setCookie(...)` em massa, `page.evaluate(...)` falha com `Error: Attempted to use detached Frame '<id>'`.
- **Causa:** o Ayoa SPA detecta a injeção de cookies e **redireciona a página** (cookies `auth.ayoa.com` setam o `auth.ayoa.com` que faz redirect para `app.ayoa.com`); o Frame original que o Puppeteer segurava foi desconectado do DOM.
- **Fix:** retry com reload entre tentativas, capturando exceções:
  ```js
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await page.evaluate(() => {/* ... */});
      break;
    } catch (e) {
      console.log(`attempt ${attempt} failed: ${e.message}; reloading...`);
      await sleep(1500);
      try { await page.reload({ waitUntil: 'networkidle2', timeout: 30_000 }); } catch (_) {}
    }
  }
  ```
- **Regra:** SEMPRE wrappear `page.evaluate` em try/catch + retry após `setCookie` massivo, mesmo que o último screenshot mostre a página "certa" — o frame pode ter sido reconectado a um Document novo.

### Upload de arquivo `.opml` no Ayoa via Puppeteer precisa de `DataTransfer` + `File`, não `setInputFiles`
- **Sintoma:** `<input type="file">` é criado dinamicamente no dropzone. `setInputFiles` falha com "File chooser dialog can only be created for a file chooser".
- **Causa:** o Ayoa usa um `<input type="file">` SYNTHETIC criado via `document.createElement('input')` em vez do file chooser nativo. O Puppeteer não consegue interceptar o file chooser.
- **Fix:** injetar o `File` via `DataTransfer` no `input.files`:
  ```js
  const blob = new Blob([opmlText], { type: 'text/x-opml' });
  const file = new File([blob], filename, { type: 'text/x-opml' });
  const dt = new DataTransfer();
  dt.items.add(file);
  Object.defineProperty(input, 'files', { value: dt.files, writable: false });
  input.dispatchEvent(new Event('change', { bubbles: true }));
  ```
  O Ayoa processa o upload via listener `onchange` no input, não no dropzone — o `dispatchEvent('change')` é suficiente. **Não** tente `dispatchEvent('drop')` no dropzone — Ayoa usa o input, não o dropzone.

### Cookies exportados do Android Files vêm do `Pictures/cookies.json` (EditThisCookie), 1800+ cookies
- **Sintoma:** o user cola no chat o caminho `storage/emulated/0/Pictures/cookies.json` (Android Files).
- **Causa:** EditThisCookie exporta o **conjunto completo** de cookies do navegador, não só os do domínio relevante. Resultado: ~1800 cookies cobrindo `.google.com`, `.stripe.com`, `.tiktok.com`, `.ayoa.com`, etc.
- **Fix:** usar o arquivo inteiro — o Puppeteer filtra por domínio automaticamente. Não pré-filtrar — os cookies de tracking (`_fbp`, `_ga`, `_rdt_*`) **são** necessários para o Ayoa autenticar; sem eles, o Ayoa mostra tela de login. **Sempre** preservar a forma original: `cp ~/storage/pictures/cookies.json ~/tmp/ayoa-cookies-test.json && chmod 600`.

### Clipboard race condition do Android: o conteúdo pode mudar entre reads
- **Sintoma:** primeiro `termux-clipboard-get` retorna cookies válidos (3370 chars); segundo read (5s depois, no mesmo shell command) retorna 0 chars.
- **Causa:** outro app Android (teclado, autocomplete, notificação) sobrescreve o clipboard entre leituras. Comum em Termux/Android.
- **Fix (defesa em profundidade):** capturar o conteúdo para tmpfile com `shred -u` no fim, **antes** de qualquer validação, e usar o tmpfile nas chamadas subsequentes. NÃO fazer `termux-clipboard-get` duas vezes esperando o mesmo resultado. Se o conteúdo do tmpfile não parsear como JSON de cookies, pedir nova colagem ao user — **não** tentar novamente automaticamente (pode sobrescrever cookies válidos).

### Substituir `sameSite: 'unspecified'` por `'Lax'` no export EditThisCookie (cliente)
- **Sintoma:** ao validar cookies antes de injetar, vários deles têm `sameSite: 'unspecified'` (default do Chrome quando não há SameSite explícito). O Puppeteer rejeita.
- **Causa:** EditThisCookie preserva o `sameSite` original do cookie. Chrome marca "unspecified" para cookies sem SameSite explícito. O Puppeteer exige {Lax, Strict, None}.
- **Fix:** no script de import, normalizar:
  ```js
  const ss = c.sameSite === 'no_restriction' ? 'None' : (c.sameSite || 'Lax');
  if (!['Lax','Strict','None'].includes(ss)) c.sameSite = 'Lax';
  ```
  Aplicar **antes** do filtro, não depois. Cookies de tracking com `unspecified` continuam funcionando após a normalização (Lax é o default de cookies same-site no Chrome 80+).

### Ayoa present-mode auto-create gera slides para mapas com nodes importados via OPML
- **Sintoma:** ao rodar `ayoa-presenter.js --mode prepare` em um mapa recém-importado de OPML (33 nodes), o Auto-create gera 33 slides (um por outline).
- **Causa:** o Ayoa trata o mapa importado como tendo nodes já — o Auto-create gera slides correspondentes.
- **Fix:** nenhum (comportamento correto). Após o Auto-create, o `slideCount` reflete o tamanho do OPML. Capture slides a partir do `slideCount` real, não de um valor esperado fixo.

### Ayoa import OPML: mapa novo aparece em `https://app.ayoa.com/mindmaps/<new-uuid>` com 0 slides inicialmente
- **Sintoma:** após o user importar o OPML via UI, o `ayoa-presenter.js --mode list` retorna `[]` (zero slides).
- **Causa:** o OPML é carregado como **estrutura de nodes** no canvas, mas a **lista de slides** (deck de apresentação) é uma feature separada. Ela só é populada quando o user clica **Auto-create** no painel Present.
- **Fix:** o agente deve chamar `ayoa-presenter.js --mode prepare` (que dispara Auto-create via UI) **uma vez** antes de capturar slides. O `slideCount` retornado é o número de nodes do OPML + 1 (central).

### Ayoa importa OPML mas a UI é diferente do `Add all` documentado
- **Sintoma:** o botão de import aparece com label "Import" (não "Add all"). O user pode achar que não há import.
- **Causa:** Help Centre consolida imports e exports em `support.ayoa.com/imports-and-exports`; labels mudaram entre versões.
- **Fix:** usar o flow oficial documentado em `references/ayoa-import-formats.md` (passos 1–7) que cobre o botão "Import" atual.

### Limite silencioso de 50k caracteres
- **Sintoma:** DOCX/PDF/MD longos são importados mas truncados sem aviso.
- **Causa:** Ayoa processa apenas os primeiros 50k caracteres.
- **Fix:** fatiar o input antes do import. A skill `google-drive` tem parser de heading que pode ser usado para chunking por seção.

## OPML parser pitfalls (skill `google-drive` e `ayoa-mindmap`)

### OPML parser bug: regex `g` flag perde `m[4]` em self-closing tags
- **Sintoma:** `<outline text="A"/>` parseia como `open` mas **sem** o `close` correspondente, quebrando o `buildDom` (stack desbalanceada).
- **Causa:** o regex `<(\/?)(\w[\w-]*)((?:\s+...)?)*\s*(\/?)>` com flag `g` literal não preserva o grupo `(\/?)` em execuções repetidas em alguns engines (Node 22+). O grupo `m[4]` retorna `""` em vez de `/` após a primeira match.
- **Fix:** usar `new RegExp(re.source, 'g')` em vez de `re` direto:
  ```js
  const source = /<(\/?)(\w[\w-]*)((?:\s+\w[\w-]*(?:\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+))?)*)\s*(\/?)>/.source;
  const execRe = new RegExp(source, 'g');
  let m;
  while ((m = execRe.exec(clean)) !== null) { /* m[4] correctly captures '/' */ }
  ```
- **Teste de regressão:** `parseOpml('<opml><head><title>T</title></head><body><outline text="A"/></body></opml>')` deve retornar `nodeCount: 1` (sem isso, retorna 0 ou lança `unclosed tag`).
- **Regra genérica:** quando usar regex com `*` em grupos opcionais E flag `g`, sempre construa via `new RegExp(re.source, 'g')` em vez de inline. A diferença é sutil mas crítica para XML com self-closing tags.

### `assert.throws` com regex em Node strict mode precisa de `<>` literais nos tags
- **Sintoma:** `assert.throws(() => parseOpml('<opml>...</opml>'), /body is required/)` falha com "input did not match". O erro real é `OPML: <body> is required` (com `<` e `>`).
- **Causa:** `assert.throws(fn, regex)` testa se a string de erro **contém** o pattern. `/body is required/` não casa `OPML: <body> is required` porque o `b` no `body` está imediatamente precedido por `<` no `<body>`. Mas o pattern `/body is required/` casa QUALQUER sequência "body is required" — e na string "OPML: <body> is required", o trecho **é** "body> is required" (com `>` entre `body` e ` is required`). A regex exige "body SPACE is required" mas tem "body GT SPACE is required".
- **Fix:** usar `/<body> is required/` (com `<>` literais) ou `s.includes('body is required')` para matching exato. **Sempre** testar o match com a string real antes de fixar o regex no test.
- **Regra:** em tests de `assert.throws`, preferir `s => s.includes('<body> is required')` (predicate) ou string literal exata; regex só se a string é garantidamente simples.

### OPML parser: preferir matcher function em `assert.throws`
- **Sintoma:** tests falham por mismatch de regex, mas o erro real é de mensagem.
- **Fix:** preferir `assert.throws(fn, e => e.message.includes('exact substring'), 'message')`. Matcher function é mais robusto que regex para mensagens com caracteres especiais (`<`, `>`, `\`, etc).

## Autenticação

### Cookie expirado
- **Sintoma:** Redireciona para `auth.ayoa.com/login` mesmo com cookies setados
- **Causa:** `ayoa.ap` ou `ayoa.user` expirados ou invalidados pelo servidor
- **Fix:** Copiar cookies novos do navegador com sessão ativa
- **Atenção:** `expirationDate` futura não prova que a sessão continua válida. A verificação vinculante é a URL após o 2-hop: qualquer `https://auth.ayoa.com/login?...` é falha de autenticação. Desde v1.15.1, `import-opml-v3.js` aborta com exit 1 e JSON `ok:false`; nunca deve continuar na tela de login nem devolver `mindmapId:null` como sucesso.

### Cookie não propaga para subdomínio
- **Sintoma:** Login funciona em `www.ayoa.com` mas redireciona em `app.ayoa.com`
- **Causa:** Domain sem ponto inicial — `domain: "ayoa.com"` vs `domain: ".ayoa.com"`
- **Fix:** Usar `domain: ".ayoa.com"` (com ponto) no Puppeteer setCookie

### setCookie exige domínio raiz primeiro
- **Sintoma:** `setCookie` não tem efeito
- **Causa:** Puppeteer exige que a página tenha navegado ao domínio antes de aceitar cookies
- **Fix:** `page.goto('https://www.ayoa.com/')` ANTES de `page.setCookie()`

## SPA Loading

### "Carregando…" infinito
- **Sintoma:** Página mostra "Carregando…" por mais de 15s
- **Causa:** SPA React pesado + headless_shell
- **Fix:** Aguardar 8s, checar texto, se ainda carregando +10s. Máximo: 18s
- **Referência:** Slide "Carregando…" sumiu consistentemente após 12-18s

### Cookie banner bloqueia visão
- **Sintoma:** Banner "To improve your experience..." no bottom
- **Fix:** Clicar `button[aria-label="Accept"]` — dispensa o banner

## Navegação

### Slide ID numérico inválido para querySelector
- **Sintoma:** `document.querySelector('li#9f9c715d...')` → erro "not a valid selector"
- **Causa:** IDs de slide começam com número (ex: `9f9c715d-3a0a-...`)
- **Fix:** Usar `document.getElementById(id)` em vez de querySelector

### Slide sem número no counter
- **Sintoma:** Primeiro slide não tem `.slides-list-group-counter` visível
- **Causa:** Primeiro slide tem formato especial (central node)
- **Fix:** Usar índice do array (0-based) em vez do texto do counter

### Clique em toolbar não funciona
- **Sintoma:** `page.click('.toggle-presenter')` não abre o painel
- **Causa:** Elemento é `<div>` com classe CSS, não `<button>`
- **Fix:** Usar `page.$('.toggle-presenter')` + `el.click()` ou evaluate dispatchEvent

## Captura de slides

### Chromium crasha em muitas screenshots seguidas
- **Sintoma:** `TargetCloseError: Session closed` após 300+ screenshots
- **Causa:** Memória insuficiente no Termux (Android)
- **Fix:** Capturar em lotes, fechar/abrir browser entre lotes. Máximo ~330 slides por batch

### Vídeo com ffmpeg
- **Sintoma:** Slides fora de ordem ou frames estranhos
- **Causa:** Glob pattern não ordena corretamente
- **Fix:** Usar nomes zero-padded (slide-001.png, slide-002.png...) que ordenam naturalmente no glob

## Domínios e fontes oficiais

### `help.ayoa.com` não existe (DNS não resolve)
- **Sintoma:** `curl -I https://help.ayoa.com` → "Could not resolve host"
- **Causa:** Subdomínio `help` nunca foi registrado. O help center real é `support.ayoa.com` (HubSpot KB).
- **Fix:** Substituir `help.ayoa.com` por `support.ayoa.com` em qualquer URL, script ou comentário. Verificado em 2026-07-14.

### Página canônica `present-your-mind-maps` removida (HTTP 404)
- **Sintoma:** `curl -I https://support.ayoa.com/present-your-mind-maps` retorna 404; link ainda aparece em `mind-mapping-tips-and-tricks`
- **Causa:** Página despublicada em 2026 (Help Center migrou para nova estrutura HubSpot; sitemap atual tem 262 URLs e NÃO contém a página)
- **Fix:** Consultar `references/present-mode-official.md` (Wayback 2024+2025) ou Wayback Machine `https://web.archive.org/web/2024/https://support.ayoa.com/present-your-mind-maps`

## Modo Apresentação (Present mode — Ayoa Ultimate)

### Botão Present ausente para usuários free
- **Sintoma:** Nenhum elemento corresponde ao seletor de Present em Mind Map view
- **Causa:** Present mode é exclusivo do plano Ayoa Ultimate; usuários free não veem o botão
- **Fix:** Confirmar plano da conta antes de automatizar. Para free, usar Auto-Focus como fallback (ver `references/present-mode-official.md` §7)

### Estado real do Present mode
- **Preparação:** `.slides-list-container` aberto, sem `.presenting`; botão play sem `.selected`.
- **Ativo:** `.slides-list-container.presenting` e `.slides-play-stop-button.selected`.
- **Stop/Escape:** remove `.presenting`; não confundir painel aberto com apresentação ativa.
- **Persistência:** o Ayoa pode reabrir o mapa já em Present mode; `--mode prepare` deve parar esse estado antes de devolver o deck.

### Compact mode desmonta a lista do DOM
- **Sintoma:** após compactar, `querySelectorAll('.slides-list-group-item')` retorna 0 mesmo com o deck intacto.
- **Causa:** o React troca o painel completo por `.slides-list-container.compact` e desmonta `.slides-list-content`.
- **Fix:** cachear `slides`, `activeIndex`, `activeId` e `activeTitle` antes de clicar `.slides-compact-button`.

### Bootstrap e banner podem falhar de forma transitória
- `page.goto('https://app.ayoa.com/')` pode exceder 30s na primeira tentativa; repetir com timeout 45s + backoff.
- `ElementHandle.click()` no banner Accept pode lançar "Node is either not clickable"; usar `dispatchEvent(MouseEvent)` como fallback e seguir.

### Play não inicia fullscreen automaticamente
- **Sintoma:** `.slides-play-stop-button` ativa Present mode, mas `document.fullscreenElement` continua `null`.
- **Causa:** Start e Fullscreen são controles separados; headless também não expõe fullscreen físico.
- **Fix:** validar `.presenting` no Start; depois clicar `.slides-fullscreen-button` e validar `#app-content.presenter-fullscreen`/botão `.selected`.

### Atalhos confirmados no Ayoa Web 8.170.88
- Anterior: PageUp/↑/←/Ctrl+Espaço; próximo: PageDown/↓/→/Espaço.
- Escape para; `p` inicia; `f` alterna fullscreen.
- O Ayoa ignora esses atalhos se input/textarea estiver focado; automação deve preferir controles DOM.

### Driver `runFullPresentation` com máquina de estados (v1.4.0)
- Abertura da present window precede a avaliação do estado, evitando `OpenPresenter` cego
  após persistência de `presenting=true` em sessões anteriores.
- `state_inconclusive` (panel já em Present) bloqueia em vez de prosseguir; emite evidência
  `present_mode_already_active` e encerra com `presenting=false`.
- A navegação requer `confirmStepChange` em vez de `sleep` fixo; o caso `startAt=2` mostra
  que o Ayoa redefine o primeiro slide ~200 ms após Start, então `startPresentation` agora
  revalida e re-seleciona o slide inicial correto.
- `Compact mode` desmonta a lista do DOM: o deck em `getPresentationState` é reconstruído a
  partir do cache; nunca tratar `slideCount=0` como deck vazio real quando
  `panel.classList.contains('compact')`.
- `Clear all` precisa reaparecer a `slides-list-empty` para que o Ayoa ofereça novamente
  o **Auto-create**; caso contrário, `requestFullPresentation` falha com `no-auto-create`
  e o run bloqueia.

### Botão "Adicionar" slide desabilitado
- **Sintoma:** `button.btn.btn-default.disabled` com texto "Adicionar"
- **Causa:** Só habilitado quando há mindmap com nós

### Reordenação de slides exige drag-and-drop, não clique
- **Sintoma:** `page.click()` em item da lista Present não reordena
- **Causa:** Doc oficial Wayback 2024 passo 6: "grab the branch and move it to the chosen position" — é HTML5 drag-and-drop
- **Fix:** Usar `page.mouse.down()` + `page.mouse.move()` + `page.mouse.up()` ou Playwright `dragTo()`. NUNCA apenas `click()`.

### Apresentação persiste no servidor entre sessões
- **Sintoma:** Apresentação criada em uma execução aparece como ativa na próxima
- **Causa:** Lista de slides é persistida (não cache de sessão)
- **Fix (teste):** Chamar `Clear all` no início de cada execução de teste para começar do zero

### Navegação entre slides aceita teclado
- **Sintoma:** Precisa clicar setas no menu para cada slide
- **Causa:** Doc oficial Wayback passo 16: "use directional keys in the menu, **or keys on your keyboard: arrows / space bar**"
- **Fix (script):** `page.keyboard.press('ArrowRight')` ou `page.keyboard.press(' ')` (space) — mais rápido e estável que clicar cada vez

### Deck de 1 item não dispara `next` — `lastVisited` precisa ser definido no final do run
- **Sintoma:** `runFullPresentation` em deck de 1 slide emitia `last_step_reached` mas `evidence.lastVisited` ficava `null`; consumidores do timeline que esperam o último estado quebrava.
- **Causa:** O loop de navegação só setava `lastVisited` quando havia um `step_change_confirmed` real. Em deck de 1 item, o `next` está desabilitado na entrada do loop e o corpo nunca executa.
- **Fix:** Após o bloco `last_step_reached`, garantir `evidence.lastVisited = last` quando ausente. Regra geral: a evidência `lastVisited` deve ser sempre definida ao final de um run, mesmo sem avanço.

### i18n: `Auto-create` e `Clear all` precisam de espelho em espanhol
- **Sintoma:** `autoCreatePresentation` e `clearPresentationDeck` falham quando a UI exibe `Crear automáticamente` / `Borrar todo`.
- **Causa:** As buscas hardcoded só conheciam `auto-create`/`auto create`/`criar automaticamen` e `clear all`/`limpar tudo`.
- **Fix:** Adicionar `crear automaticamen` e `borrar todo`/`borrar` ao pattern. Sempre que a skill adicionar uma string a um selector multi-idioma, listar **todas** as variações oficiais conhecidas (EN/PT-BR/ES no mínimo).

### `assert.deepEqual` no Node — a ordem dos argumentos é `actual, expected`
- **Sintoma:** `actual: [B]` e `expected: [A]` aparecem invertidos no log; o teste parecia falhar por `[A] !== [B]` quando na verdade era o `actual` que estava errado.
- **Causa:** A assinatura é `assert.deepEqual(actual, expected, message?)`. Trocar a ordem inverte o significado do log, não a expectativa.
- **Fix:** Padronizar `assert.deepEqual(after, before.slice().reverse())` para que `after` seja sempre o `actual`. Regra: em asserções de transformação, **sempre** o resultado produzido pelo sistema sob teste vai primeiro.

## Desempenho

### Puppeteer lento em Termux
- **Sintoma:** Cada operação leva 1.5-3s
- **Causa:** Chromium headless_shell em Android
- **Medido:** ~1.2s por slide, ~370 slides em ~7.5 min para captura completa

### Pipeline "gravar apresentação" — tempos medidos no mapa 481a39ca (370 slides)
- **Sintoma:** o user pediu "grave apresentação" e o pipeline demora; sem saber a ordem de magnitude, o polling fica cego.
- **Causa:** três fases com durações previsíveis no Termux headless:
  1. `ayoa-capture-slides.js --wait 1200`: ~9 min para 370 slides (4-5 min em PC com Chromium completo).
  2. `ayoa-video.js --fps 1 --crf 23`: ~50 s para 370 PNGs (FFmpeg concat, H.264/CRF 23).
  3. `mv ~/tmp/<dir>/<file>.mp4 ~/storage/downloads/`: instantâneo; `termux-open <file>` invoca o app padrão de vídeo sem bloquear.
- **Fix:** reportar contador a cada ~1 min durante a captura (PNGs criados + log de progresso). Formato padrão: `0:08 (8:16 elapsed) — 153 PNGs (150/370) — ~4 min restantes`.
- **Outputs do pipeline (validados 2026-07-14 no mapa 481a39ca):**
  - 370 PNGs em `~/tmp/ayoa-481-slides/` (41 MB total; ~100 KB por PNG em PNG-encoded Puppeteer default).
  - MP4 em `~/tmp/ayoa-481.mp4` (13.1 MB, 6m10s, 1 fps, 298 kbps). Após mover, `~/storage/downloads/ayoa-481-apresentacao.mp4` é visível no Android Files como `Download/ayoa-481-apresentacao.mp4` com owner `media_rw`.
- **Regra para "gravar":** SEMPRE use `ayoa-capture-slides + ayoa-video`, nunca `--mode run` (esse só modifica DOM, não grava nada). `--mode run` é para automação, não para captura visual.

### Canvas/zoom/pan do Ayoa trava em headless sem GPU
- **Sintoma:** `runFullPresentation` ou `ayoa-capture-slides.js` reporta `step_change_confirmed` corretamente no DOM, mas o `page.screenshot()` captura um frame inacabado (canvas em meio da animação). User relata "a apresentação não está evoluindo no browser Android".
- **Causa:** o Ayoa renderiza cada slide com **animações canvas/zoom/pan** (smooth transition, ~200-500ms) que **não terminam** no Chromium headless sem GPU (`--disable-gpu` no Termux). O `activeId` na DOM avança em milissegundos, mas o canvas visual fica travado em estado intermediário. **Atenção:** o user no Android vê uma **sessão separada** do Chromium — a skill opera o Chromium headless do Termux, não o browser do user.
- **Fix (captura):** `--wait 1200` (1.2s por slide) é a mitigação canônica em `ayoa-capture-slides.js`; deixar a animação estabilizar antes do screenshot. Se ainda travar, aumentar para `--wait 2000`.
- **Fix (run):** `confirmStepChange` espera `activeId` mudar na DOM, que **acontece** mesmo com canvas travado; o `sleep(700)` após cada `next` cobre o frame final.
- **Diagnóstico de report do user:** se o user relatar "a apresentação não está evoluindo no browser Android", o problema é que ele está vendo uma sessão **separada** do Chromium no Android; a skill opera uma instância headless no Termux. **Não é um bug da skill** — é a separação de processos. A solução é `--mode prepare` + user abrir manualmente no browser dele, OU usar `ayoa-capture-slides + ayoa-video` para gerar um MP4 local.
- **Regra:** "Executar" (`runFullPresentation`) e "Gravar" (`capture-slides + video`) são caminhos distintos; ver SKILL.md §"Dois caminhos distintos para gravar uma apresentação".

## Pipeline DevOps e publicação no GitHub (v1.6.0+)

### `process(action='wait', timeout=N)` clampa em 60s
- **Sintoma:** para jobs de 5-15 min (captura de 370 slides, runFullPresentation em mapas grandes), `process.wait` retorna "exited" antes do job terminar, ou nunca notifica se o job passa de 60s.
- **Causa:** o runtime do Hermes clampa o `timeout` da ação `wait` em 60 segundos.
- **Fix:** usar polling explícito:
  ```
  loop:
    status = process.poll(session_id=X, timeout=60000)   # 60s
    if status.exited: break
    print("elapsed:", status.uptime_seconds)
    print("PNGs criados:", terminal("ls ~/tmp/slides/ | wc -l"))
    print("último log:", terminal("tail -1 /tmp/capture.log"))
  ```
  A diferença entre `uptime_seconds` do `process.poll` e `ps -o etime= -p <pid>` é ~1-2s; usar qualquer um.
- **Regra:** nunca esperar mais de 60s com `process.wait` direto — sempre voltar ao loop.

### `npm test` canônico roda do raiz
- **Sintoma:** `npm test` na raiz do bundle falha com `Could not find 'ayoa-...test.js'` quando o `package.json` raiz tem scripts sem `cd scripts`.
- **Causa:** o `node --test` no `package.json` raiz resolve arquivos no `cwd` (raiz), onde os `.test.js` não existem — eles vivem em `scripts/`.
- **Fix:** cada script do `package.json` raiz prefixa `cd scripts &&`. Regra: **sempre** `cd scripts` antes de `node --test` em qualquer script raiz que invoque a suíte.

### Fine-grained PAT não cria repositórios
- **Sintoma:** `gh repo create --public` retorna `GraphQL: Resource not accessible by personal access token (createRepository)`.
- **Causa:** Fine-grained PATs não têm `Repository: Administration: Read and write` por padrão. O escopo `repo:status` ou `repo:contents` não basta.
- **Fix:** gerar um **Classic PAT** com escopo `repo` (criação + escrita). O bundle de skill publica via `publish-skill-to-github.sh` que aceita ambos os prefixos (`github_pat_` Fine-grained e `ghp_` Classic). Se o token for Fine-grained, o script cai no `else` (repo já existe) e só faz `git push` + `tag` + `release`.

### `git push` falha com "could not read Username" mesmo após `gh auth login`
- **Sintoma:** após `gh auth login --with-token < pat`, o `git push origin main` retorna `fatal: could not read Username for 'https://github.com': No such device or address`.
- **Causa:** `gh` armazena o token em `~/.config/gh/hosts.yml`, mas o `git` usa um credential helper separado. O token do `gh` não está automaticamente disponível para o `git`.
- **Fix:** `gh auth setup-git` configura o credential helper do `git` para usar o token do `gh`. **Sempre** rodar `gh auth setup-git` antes do primeiro `git push` após `gh auth login`.

### `gh release create` precisa do token; `git push` também
- **Sintoma:** `gh release create` falha com `Resource not accessible by personal access token` ou pede username.
- **Causa:** `gh` usa o `GITHUB_TOKEN` interno quando disponível, mas se o token é Fine-grained, ele precisa de `Repository: Contents: Read and write` E `Metadata: Read` (padrão). Para Classic PAT, basta `repo`.
- **Fix:** `gh auth setup-git` antes de qualquer `git push`; para `gh release`, usar `--repo owner/name` explícito se o `origin` não estiver configurado.

### Clipboard pode oscilar entre reads (específico Termux)
- **Sintoma:** primeiro `termux-clipboard-get` lê o PAT, segundo lê texto de chat, terceiro lê o PAT de novo.
- **Causa:** o clipboard do Android é reescrito entre reads pelo app de chat, autocomplete ou notificações.
- **Fix:** **validar a forma** (prefixo + tamanho + shape regex) **antes** de prosseguir. Se o primeiro read falhar shape, re-read sem pedir nova colagem do usuário. Não ecoar o conteúdo nem mesmo para dizer "isto não parece um token" — tratar como paste de credencial e redirecionar via arquivo.

### `gh` instalado mas não autenticado após logout
- **Sintoma:** `gh auth status` retorna `not logged into any GitHub hosts` mesmo com `gh` 2.95.0 instalado.
- **Causa:** o login expira ou nunca foi feito nesta sessão.
- **Fix:** `gh auth login --with-token <(cat ~/tmp/<svc>-token.txt)` lê do arquivo em vez do prompt. **Nunca** colar o token como argumento de linha de comando — fica em `/proc/<pid>/cmdline` e em `history`.

### Não processar PAT/PII no chat mesmo após "copiado"
- **Sintoma:** o usuário cola o PAT no chat dizendo "copiado" e o sistema começa a processar.
- **Causa:** qualquer string no chat fica em histórico, sync, e backup. **Regra:** após "copiado" no chat, **só** ler via `termux-clipboard-get`. Processar o conteúdo apenas para validar forma (prefixo + tamanho + regex). Se o conteúdo estiver no chat, considerar comprometido e orientar revogação.
- **Fix no bundle:** `publish-skill-to-github.sh` lê o clipboard, valida o prefixo `github_pat_*` ou `ghp_*`, e grava em tmpfile com `umask 077` + `trap` + `shred -u` no fim. O script não imprime o token em nenhum momento.
