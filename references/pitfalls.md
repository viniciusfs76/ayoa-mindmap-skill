### Ayoa v2 POST `/v2/sync` retorna 204 mas mutation NÃO persiste
- **Sintoma:** `scripts/ayoa-apply-theme.js --themeId radial` mostra `status: 204` no JSON; `/v2/init` reconsultado mantém `themeId: 'organic_v2'`. O PATCH não persistiu.
- **Causa (provável):** mutations de tema/layout vão via **Centrifugo WS** (note `POST /v2/client` retorna `channelId: b97ce16a-…`, e o payload capturado do Ayoa UI **não envia** `themeId` em nenhum lugar — só faz `setState` local e o WS propaga). `/v2/sync` REST é canal secundário; ack do REST não é ack do canvas.
- **Diagnóstico:** comparar o body capturado por `scripts/ayoa-capture-while-formatting.js` durante uma sessão Formatar real (Play → Tema no Android) com o body que `ayoa-apply-theme.js` está enviando. Se o user formata um único nó e o body é diferente do path global, é porque mutation single-node usa outro canal.
- **Fix (parcial):** para mutations top-level que aceitam REST sync (provavelmente `branchThickness`, `backgroundColor`, `boardFontFamily` — paths simples sem `_p0.matchKey`), o `/v2/sync` deve persistir. Para `themeId` em particular, **sniffar** uma sessão Formatar real antes de tentar automatizar.
- **Regra:** status 204 em REST da Ayoa é ack de rede, não de aplicação. Sempre reconsultar `/v2/init` (ou navegar de novo ao mapa) para confirmar persistência.

### Capture pipeline trava com `FATAL: Error: Ayoa mind map did not finish loading within 40000ms` mesmo com cookies validos (orfaos headless_shell segurando o pool, 2026-07-16)

- **Sintoma:** Primeira tentativa de `ayoa-capture-slides.js` (ou `ayoa-presenter.js`) morre em ~40s com `FATAL: Error: Ayoa mind map did not finish loading within 40000ms at Object.navigateToMindmap (ayoa-login.js:124)`. Login funcionou (cookie banner dismissed), mas `navigateToMindmap` nunca termina. O processo fica "running" por minutos sem progresso; `ls <slides>/` continua vazio. Sintomas secundarios: `ps -ef | grep headless_shell` mostra 2-3 instancias com CPU > 1:30 (nao sao o capture atual — sao orfaos de sessoes anteriores). `tail -10` engole a saida, entao o erro so aparece quando o user recebe a notificacao de conclusao do background proc.
- **Causa:** Pool de Chromium do Termux (`$PREFIX/lib/chromium/headless_shell`) tem limite pratico de ~1-2 instancias simultaneas em single-process mode. Puppeteer `--user-data-dir=...` profile dirs ficam orfaos quando o processo morre via timeout / kill -9 / OOM. Os profiles nao sao limpos automaticamente. Na proxima sessao, o capture novo compete com os orfaos por RAM; o `navigateToMindmap` excede 40s porque o browser nao consegue iniciar antes do deadline.
- **Diagnostico (rode ANTES de relancar):**
  ```bash
  ps -ef | grep headless_shell | grep -v grep | awk '{print "PID="$2" CPU="$7" PPID="$8}'
  # Se houver mais de 1 instancia, OU se CPU > 1:00 em PPID que nao e o seu processo atual, sao orfaos.
  ```
- **Fix:** `kill -9` os PIDs orfaos antes de relancar:
  ```bash
  ps -ef | grep headless_shell | grep -v grep | awk '{print $2}' | xargs -r kill -9
  sleep 2
  ps -ef | grep headless_shell | grep -v grep | wc -l   # deve ser 0
  ```
  **NAO** use `pkill -f headless_shell` — mata seu proprio bash se o pattern casar com o argv do agent (pitfall ja documentado em "Termux-specific test-runner pitfall"). Use o pipeline `ps + awk + xargs kill -9` que filtra apenas `headless_shell`.
- **Validado:** 2026-07-16 — mapa `353b6373-…` (Engenharia Reversa de APIs Web, 57 slides). Primeira tentativa morreu em 41s; apos `kill -9` dos PIDs 29714 + 31735 (CPU 01:56 e 02:02), relancou em 137s e completou 57/57 PNGs sem recovery.
- **Regra:** antes de qualquer `ayoa-capture-slides`, `ayoa-presenter` ou `import-opml`, verificar pool de Chromium. Se houver > 1 instancia headless_shell, limpar. Adicionar ao precheck do workflow canonico `--mode prepare → capture-slides → video`.

---

### `ayoa-capture-slides.js` encontra 0 slides em mapa que tem slides (SPA render race)
- **Sintoma:** `ayoa-capture-slides.js` loga "Presenter opened, 0 slides found" e salva 0 PNGs. Rodar `--mode prepare` imediatamente depois encontra os slides (ex.: 211 slides em mapa `9ffae34e-…` em 2026-07-16).
- **Causa:** o SPA React do Ayoa abre o painel Apresentador antes de terminar de renderizar a lista de slides. `openPresenter()` detecta o painel como pronto (`'.slides-list-container'` presente), mas os `.slides-list-group-item` ainda não foram montados no DOM.
- **Fix:** SEMPRE rodar `ayoa-presenter.js --mode prepare` ANTES de `ayoa-capture-slides.js`, mesmo em mapas existentes com slides já populados. O `preparePresentation` chama `openPresenter` com retry e `getSlideList` após estabilização.
- **Regra capture flow canônica:** `--mode prepare → capture-slides → video`. O `prepare` não destrói slides existentes (chama `autoCreate` só se `slideCount === 0`), então é idempotente.
- **Pitfall análogo:** "mapa novo do import OPML aparece com 0 slides" — o mesmo `--mode prepare` resolve. A diferença é que import OPML deixa o deck vazio de verdade (precisa Auto-create), enquanto mapas existentes podem ter o deck populado mas invisível por race do SPA.

### `page.evaluate(fetch('/v2/init'))` BLOQUEIA sem retornar — `/v2/init` é 8.5 MB
- **Sintoma:** `await page.evaluate(async () => { const r = await fetch('/v2/init', {credentials:'include'}); const j = await r.json(); return j.user._id; })` nunca resolve; o script trava por minutos.
- **Causa:** `/v2/init` retorna **8.5 MB** (1000+ papers do usuário, projects, folders, etc.). O JSON.parse no contexto da página pode levar dezenas de segundos em Chromium headless sem GPU. Some isso ao `networkidle2` da navegação e o `await` nunca completa.
- **Fix:** ler via CDP `page.on('response')`, NÃO via `page.evaluate(fetch(...))`:
  ```js
  let userId = null;
  page.on('response', async r => {
    if (userId) return;
    if (r.url().includes('/v2/init')) {
      try { const j = await r.json(); userId = j.user._id; } catch {}
    }
  });
  if (!page.url().includes(`/mindmaps/${MINDMAP_ID}`)) {
    await page.goto(`https://app.ayoa.com/mindmaps/${MINDMAP_ID}`, {waitUntil:'domcontentloaded'});
  }
  for (let i = 0; i < 20 && !userId; i++) await new Promise(r => setTimeout(r, 500));
  ```
- **Regra:** para qualquer response do Ayoa > 1 MB, usar CDP `page.on('response')` em vez de `page.evaluate(fetch(...))`. Aplica-se a `/v2/init`, `/v2/import-jobs` (com 200+ items), `/v2/export-jobs`, etc.
- **Bonus:** se o `page.evaluate(fetch(...))` for inevitável (e.g., para forçar uma request que ainda não foi disparada), aplicar `Promise.race([fetch, new Promise((_, r) => setTimeout(() => r(new Error('timeout')), 3000))])` e seguir com headers do `/v2/analytics-events` como fallback.

---

### `themeId` aplica via `/v2/sync` com `_p0.matchKey` — endpoints REST clássicos retornam 204 silencioso (2026-07-16)

- **Sintoma:** `PATCH /v2/papers/<id>`, `PATCH /v2/mindmaps/<id>`, `POST /v2/papers/<id>/theme`, `POST /v2/mindmaps/<id>/theme`, `PATCH /v2/sync` sem `_p0.matchKey` retornam 204 mas o `themeId` no `/v2/init` consultado em seguida continua `organic_v2`. O tema não muda visualmente após reload.
- **Causa:** `PATCH /v2/sync` muta via envelope `UPDATE_ENTITY` com `patches: [{ op, path, value, _p0: { matchKey: paperId } }]`. O servidor roteia o patch usando `matchKey` para achar o paper; sem ele, descarta silenciosamente.
- **Nota:** corrige PARCIALMENTE o pitfall "POST `/v2/sync` retorna 204 mas mutation NÃO persiste" acima — para `themeId` (e provavelmente outros campos top-level passiveis de patch), `/v2/sync` **persiste** desde que contenha `_p0.matchKey`. A regra "204 não garante persistência" continua válida (sniff `/v2/init` após mutação).
- **Fix:** `scripts/ayoa-apply-theme.js` constrói o body correto com o envelope UPDATE_ENTITY + _p0.matchKey. Headers: `x-auth-token`, `x-client-id`, `x-source`, `x-source-version`, `x-agent`. `userId` vem do `/v2/init` via `page.on('response')` (ver pitfall acima).
- **Probes:** `scripts/ayoa-probe-theme-endpoints.js` (10 endpoints REST) + `scripts/ayoa-probe-patch-shape.js` (6 shapes de patch contra `/v2/sync`). Usar como referência para outras mutations (branchThickness, layoutType, etc.).
- **Validado:** 2026-07-16 — Maço WAIC mapa `abe443ca-23c0-4487-9909-ca50e29f45a0`, themeId `organic_v2` aplicado com sucesso.

---

### Ayoa recarrega após persistir cada patch (rewrite Buzan trava após ~10 nós, 2026-07-16)

- **Sintoma:** Ao usar `page.evaluate` para inserir texto em nó Buzan, após ~10 nós Ayoa dispara `Error: Execution context was destroyed, most likely because of a navigation` e quebra o loop. Sem tratamento, o job termina com 10/33.
- **Causa:** Ayoa persiste patches de texto via `/v2/sync` e dispara refresh do canvas. Cerca de 10 nós passam sem reload, depois ~5 disparam.
- **Fix:** envolver `page.evaluate` em try/catch. No `catch`: marcar o nó como `rewritten++` (persistência já feita antes do reload); `page.goto(MINDMAP_URL)` para reestabilizar; `sleep(3000)`; continuar o loop. Pattern em `scripts/ayoa-rewrite-buzan-nodes.js`.
- **Stats:** 32/33 nós em ~50s. Para mapas > 100 nós, dividir em batches de 30 com restart completo do browser entre eles.
- **Validado:** 2026-07-16 — Maço WAIC mapa `abe443ca-23c0-4487-9909-ca50e29f45a0` (33 nós Buzan → 32/33 reescritos). Receita completa em `references/buzan-fallback-recipe.md` da skill `doc-to-ayoa-mapa`.

---

### Polling de progresso de capture com `terminal(sleep + ls)` cai em warning de loop repetido (2026-07-17)

- **Sintoma:** três rodadas seguidas de `terminal(command='sleep 60; ls <slides>/ | wc -l')` retornam `[Command timed out after 60s]` (timeout default do `terminal` foreground é 60s) e o runtime dispara `[Tool loop warning: repeated_exact_failure_warning; count=2; ... This looks like a loop; inspect the error and change strategy instead of retrying it unchanged.]`.
- **Causa:** o `terminal` foreground tem cap de 60s. `sleep 60` sozinho já esgota o budget antes do `ls` rodar. E como o comando é o mesmo toda vez, o runtime detecta padrão repetido.
- **Fix:** usar `process(action='wait' timeout=45)` ou `process(action='poll')` para progressos de capture (não bloqueia o agent, e quando o proc termina a notificação chega sozinha). Padrão correto:
  ```bash
  # Iniciar capture em background com notify_on_complete=true
  # Depois, polling via process(action='poll', session_id=..., timeout=45)
  ```
  Alternativa inline sem `process`: chamadas separadas de `terminal(command='ls <slides>/ | wc -l', timeout=5)` (sem `sleep` embutido) — o intervalo entre chamadas é gasto pelo próprio agent loop, não pelo `terminal`.
- **Caveat:** o `process(action='wait')` é limitado a ~60s por chamada. Para captures > 5 min, fazer múltiplos `process(action='poll' timeout=45)` em vez de um `wait` longo.
- **Validado:** 2026-07-17 — captura do mapa `a83d9032-…` (GDC Pillars, 78 slides) onde o padrão `terminal sleep 60 + ls` gerou 3 loop warnings; troca por `process(poll)` eliminou o problema e completou em 173s.
- **Regra:** qualquer captura de Ayoa com deck > 30 slides → background proc + `process(poll)` em vez de `terminal(sleep + ls)`.

---

### Cookie JSON truncation: pre-flight rejeita mas JSON.parse do Node aceita (2026-07-19)

- **Sintoma:** `import-opml.js --cookies X` falha com `Cookie preflight: LOAD_ERROR — cookies file is not valid JSON: Unterminated string in JSON at position 100001 (line 1 column 100002)`. Mas um `node -e "console.log(JSON.parse(fs.readFileSync('X','utf8')).length)"` retorna um número (~1860) sem erro.
- **Causa:** o arquivo está truncado em ~100KB. O `JSON.parse` do Node foi **tolerante** porque a substring antes da posição 100001 era um array bem-formado; o prefixo parseou, e o `.length` retornou o número de elementos do array incompleto (que estava sintaticamente válido até onde foi escrito). O `import-opml.js` (e o `cookie-validator` canônico) usa parser estrito que **olha o resto do buffer** e detecta a quebra.
- **Diagnóstico:** comparar os dois parsers.
  ```bash
  # estrito (rejeita)
  node scripts/import-opml.js --cookies X.json
  # tolerante (aceita prefixo)
  node -e "console.log(JSON.parse(require('fs').readFileSync('X.json','utf8')).length)"
  ```
- **Causa-raiz mais comum:** EditThisCookie export copiado parcialmente via clipboard Android (que tem limit de tamanho ou truncamento em paste longo); copy via Files do Android parcial; download via Drive que cortou.
- **Fix:** pedir ao user para re-exportar do Chrome via EditThisCookie sem cortar (clipboard race é o suspeito #1 no Termux/Android). Validar antes de prosseguir:
  ```bash
  node -e "const j=require('fs').readFileSync('X.json','utf8'); JSON.parse(j); console.log('OK',j.length,'bytes')"
  ```
  Se retornar OK e tamanho > 600KB (= ~1860 cookies), está íntegro.
- **Pitfall correlato: NEVER bypass do preflight sem diagnosticar causa-raiz.** Mesmo que `ayoa-login.js` standalone mostre `Session established at: https://app.ayoa.com/`, o preflight do `import-opml.js`/`ayoa-capture-slides.js`/`ayoa-presenter.js` pode ainda falhar por causa diferente (JSON truncado, cookie crítico faltando, formato incompatível). A sessão estabelecida via 2-hop login não é prova de JSON íntegro.
- **Validado:** 2026-07-19 — cookiesAyoa.json de 100003 B truncado em ~1860 cookies; ayao-login.js estabeleceu sessão (1859 injetados, Session established), mas import-opml.js rejeitou com LOAD_ERROR. Solução: pedir novo export completo.

### Cookie validator canônico dá FALSO-POSITIVO de expiração em cookies de outros sites (2026-07-19)

- **Sintoma:** `node ~/.hermes/skills/ayoa-login/scripts/ayoa-cookies-check.js X.json` retorna `EXPIRED — Cookies expired: __Secure-next-auth.session-token, __Secure-pplx.session.<uuid>`. Mas os 3 cookies críticos do Ayoa (`ayoa.ap`, `ayoa.sid`, `ayoa.user` no domain `.ayoa.com`) estão todos `expired: false` quando checados manualmente.
- **Causa:** o validator canônico (`ayoa-login/scripts/lib/cookie-validator.js`) verifica `__Secure-next-auth.session-token` (auth Next.js do Ayoa) **e** `__Secure-pplx.session.<uuid>` (auth Perplexity). O segundo é de **outro site** (PPLX), não do Ayoa. Cookies são exportados via EditThisCookie para **todos os domínios**, então o validator detecta expiração em cookie de site não relacionado.
- **Diagnóstico:** checar quais `domain` os cookies expirados pertencem:
  ```bash
  node -e "
    const c = JSON.parse(require('fs').readFileSync('X.json','utf8'));
    const now = Math.floor(Date.now()/1000);
    c.filter(x => x.domain && x.domain.includes('ayoa.com'))
     .forEach(x => {
       const exp = x.expirationDate;
       console.log(x.domain, x.name, exp, exp < now ? 'EXPIRED' : 'OK');
     });"
  ```
- **Fix:** NÃO confiar em EXPIRED do validator quando os cookies Ayoa estão OK na verificação manual. Sempre cruzar com (a) `ayoa-login.js` standalone Session established, e (b) o ad-hoc check acima.
- **Pattern a seguir quando EXPIRED mas você suspeita falso-positivo:** rodar o `check-ayoa.js` ad-hoc; se os 3 críticos do Ayoa estão `expired: false`, é seguro prosseguir.
- **Caveat:** se algum dos 3 críticos (`ayoa.ap`, `ayoa.sid`, `ayoa.user`) estiver `expired: true`, aí sim é EXPIRED real e precisa re-export. Validado 2026-07-19: arquivo de 100KB tinha 10 cookies `.ayoa.com`, todos válidos.

### `JSON.stringify(regex)` produz `{}` e quebra downstream (2026-07-19)

- **Sintoma:** `JSON.stringify(/encrypted/i)` retorna `"{}"` (objeto vazio). O valor serializado perde a `.source` e os flags. Ao deserializar com `JSON.parse` no browser, `re.test` lança `re.test is not a function` porque `re` é `{}`.
- **Causa:** `RegExp.prototype.toJSON()` (ECMAScript 2019) retorna `{}` por design — regex não tem representação JSON canônica. `JSON.stringify` invoca `toJSON()` automaticamente, perdendo a regex.
- **Pitfall correlato:** `re.constructor === RegExp` retorna `true` mesmo após `JSON.parse(JSON.stringify(re))`, porque o objeto reconstruído tem o protótipo RegExp herdado mas **sem source/flags** — silent breakage.
- **Fix:** serialize `.source` + flags explicitamente, reconstrua no destino:
  ```js
  // origem
  const arr = patterns.map(r => r.source);          // serializável
  JSON.stringify({ patterns: arr, flags: 'i' });   // round-trip-safe
  // destino
  const patterns = sources.map(s => new RegExp(s, flags));
  ```
- **Pitfall adicional: serializar `regex.source` com `'` (single-quote) quebra JSON.stringify.** `regex.source` pode conter `\s` etc. (chars seguros) mas raramente `'`. Se aparecer: `s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")` antes do JSON.stringify.
- **Onde esse pitfall morde:** qualquer script que injeta lib utilitária no browser via `page.evaluate(libSource)` precisa serializar patterns. Padrão correto: usar `eval(libSourceInlined)` no browser, onde `libSourceInlined` é uma template string com `JSON.stringify(sysPatternsSource)` (sources como strings), reconstruído com `new RegExp(s, 'i')` no browser.
- **Validado:** 2026-07-19 — `wa-media-handler.js` tinha `SYSTEM_PATTERNS = [...]` (array de RegExp); injetado via `new Function('module', 'exports', libSource)(mod)` falhou no browser strict mode (módulo reservado), depois via `eval(JSON.stringify(lib.SYSTEM_PATTERNS))` retornou `{}` e `re.test is not a function`. Fix definitivo: serializar como `lib.SYSTEM_PATTERNS.map(r => r.source)`, injetar `new RegExp(s, 'i')` no browser.

### Puppeteer strict mode: `new Function('module', 'exports', lib)` falha com `module is not defined` (2026-07-19)

- **Sintoma:** `await page.evaluate(({libSource}) => { new Function('module', 'exports', libSource)(libModule, libModule.exports); ... })` lança `ReferenceError: module is not defined at evaluate (evaluate at ..., <anonymous>:1:1)`.
- **Causa:** todo `page.evaluate` roda em strict mode por padrão no Chromium. `module` é nome reservado do Node CommonJS; em strict mode browser, declará-lo como parâmetro da `Function` funciona, mas acessá-lo dentro do body falha porque o escopo léxico do strict mode proíbe implicit globals — e Puppeteer pode ser ainda mais restritivo dependendo da versão.
- **Fix:** NÃO usar `module` como nome. Em vez disso, expor a lib via `eval(libSourceInlined)` no escopo do evaluate, onde `libSourceInlined` é uma template string gerada no Node (sem `module.exports`, sem nome reservado):
  ```js
  // No Node, prepara source como string serializável:
  const libSourceInlined = `
    const SYSTEM_PATTERNS = ${JSON.stringify(sources)};
    function isSystemMsg(t) { ... }
    function classifyBubble(el) { ... }
  `;
  // No browser via page.evaluate:
  await page.evaluate(({libSourceInlined}) => {
    eval(libSourceInlined);  // instala funções no escopo do evaluate
    // ... usa classifyBubble, isSystemMsg diretamente
  }, { libSourceInlined });
  ```
- **Pitfall adicional: `eval` em strict mode só roda em código que veio do mesmo origin.** `page.evaluate(code)` faz exatamente isso — code vem do Node, executado no context da página. É seguro.
- **Validado:** 2026-07-19 — lib utilitária (12 KB) tinha que rodar dentro de WA Web pra classificar bubbles; primeira tentativa `new Function('module', 'exports', libSource)(mod)` falhou strict mode; segunda `eval(libSourceInlined)` funcionou após `lib.SYSTEM_PATTERNS.map(r => r.source)` para serialização.

### Estimativa de tempo de capture: ~2.5s/slide (não 1.2s do `--wait`)

- **Sintoma:** orçamento "1.2s/slide × 313 slides = 6 min" subestima por 2x. Real observado em 2026-07-17 (mapa `eb091f5e-…`, 313 slides): 762s = 12min42s. Taxa: **2.4s/slide real**.
- **Causa:** `--wait 1200` é o tempo *após o slide estar pronto*; a navegação Next + render do canvas + screenshot leva ~1.2-1.5s adicionais. Total por slide = wait + nav + render + screenshot.
- **Estimativa calibrada (2026-07-17):**
  | Slides | Tempo real | Taxa |
  |---|---|---|
  | 57 (Engenharia Reversa) | 137s | 2.4s/slide |
  | 78 (GDC Pillars) | 173s | 2.2s/slide |
  | 313 (STATUS GDC/IJDC) | 762s | 2.4s/slide |
  Fórmula: `segundos ≈ slides × 2.5`. Some overhead fixo de ~30s (login + navigateToMindmap + openPresenter + banner dismiss).
- **Regra:** orçamento "quantos minutos vai levar" = `(N_slides × 2.5 + 30) / 60`. Para 313 slides = ~13min30s. Atualizar mental model antes de prometer tempo ao user.
- **Workaround:** se quiser vídeo mais curto, reduzir fps (`--fps 1/2` = 2s/slide = ~10min para 313 slides) ou filtrar slides (`--from N --to M`).
