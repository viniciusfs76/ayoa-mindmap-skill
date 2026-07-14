# Pitfalls conhecidas do Ayoa (verificado: 2026-07-14)

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

## Autenticação

### Cookie expirado
- **Sintoma:** Redireciona para `auth.ayoa.com/login` mesmo com cookies setados
- **Causa:** `ayoa.ap` ou `ayoa.user` expirados (ver `expirationDate`)
- **Fix:** Copiar cookies novos do navegador com sessão ativa

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
- `ElementHandle.click()` no banner Accept pode lançar “Node is either not clickable”; usar `dispatchEvent(MouseEvent)` como fallback e seguir.

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
