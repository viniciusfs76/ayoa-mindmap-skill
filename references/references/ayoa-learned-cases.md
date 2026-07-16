# Casos Aprendidos — Ayoa Mindmap Skill

Este arquivo registra cada caso novo descoberto durante execuções reais do Ayoa.
Cada entrada documenta: o que aconteceu, diagnóstico, correção e teste.

---

## Caso #001 — Captura completa de mente map "Brasil Mais Digital"

**Data:** 2026-07-14
**Tarefa:** Abrir mindmap, entrar em modo apresentação, capturar todos os slides como PNG, gerar vídeo.
**Scripts usados:** `ayoa-login.js`, `ayoa-presenter.js`, `ayoa-capture-slides.js`, `ayoa-video.js`

### O que funcionou
- Login por cookies com domain `.ayoa.com` → sucesso
- Botão `toggle-presenter` encontrado em x=994,y=59 → painel Apresentador abriu
- 370 slides listados no `<ol>` dentro de `.slides-list-content`
- Cada slide clicado via `element.getElementById(id).dispatchEvent(click)` → canvas atualizou
- Screenshots salvos como `slide-001.png` a `slide-370.png`
- Vídeo gerado com ffmpeg: `-framerate 1/3 -pattern_type glob`, 29MB, 18:30min

### Problemas encontrados

| Problema | Causa | Correção |
|----------|-------|----------|
| Slide IDs não funcionam com querySelector | IDs começam com número (ex: `9f9c715d...`) | Usar `document.getElementById()` |
| Chromium crasha após 331 screenshots | Memória no Termux | Segundo batch para slides 332-370 |
| Botão Presenter não era `<button>` mas `<div>` | Ayoa usa div com classe CSS | Usar `page.$('.toggle-presenter')` |

### Testes adicionados
- `ayoa-test-suite.js` → teste de login, presenter, captura por lote

### Lição
Capturar 370 slides em lote único exige >300MB RAM contínua. Para mindmaps grandes (>300 slides), fazer em 2 batches.

---

## Caso #002 — Preparação e navegação completas no Present mode

**Data:** 2026-07-14
**Tarefa:** Corrigir a skill para preparar um deck, iniciar/parar Present mode,
navegar e ativar compact/fullscreen de forma verificável.
**Scripts afetados:** `ayoa-login.js`, `ayoa-presenter.js`, testes `ayoa-*.test.js`

### Diagnóstico

- O script antigo apenas abria a lista e clicava slides; não comprovava o estado
  `.presenting`, nem implementava Start/Stop, setas, compact ou fullscreen.
- O Ayoa persiste `presenterActive`; um novo processo podia abrir o mapa já apresentando.
- Compact mode desmonta os itens de slide do DOM, fazendo o estado cair falsamente para zero.
- A SPA exibiu dois flakes reais: timeout no bootstrap e banner Accept não clicável.

### Correção

- `preparePresentation()` abre idempotentemente, auto-cria só se vazio e para estado antigo.
- `startPresentation()`, `stopPresentation()` e `navigatePresentation()` verificam transições.
- `setCompactMode()`/`setFullscreenMode()` são idempotentes; cache preserva deck/slide ativo.
- Login ganhou retry com backoff; banner ganhou fallback DOM.
- CLI ganhou `--mode prepare` e `--mode present --action ...`.

### Testes e evidências

- RED inicial: 5/5 falharam por APIs inexistentes.
- GREEN final: 14/14 testes determinísticos passaram.
- E2E autenticado: 370 slides; Next selecionou `🎯 COMPROMISSOS CENTRAIS`
  (`activeIndex=1`); `presenting=true`, `compact=true`, `fullscreen=true`.
- Evidência visual: screenshot sem toolbars de edição e com controlador compacto.

### Lição

Validar Present mode por estados semânticos (`.presenting`, slide ativo, cache do deck),
não por simples existência do painel ou por `document.fullscreenElement`.

---

## Caso #003 — Driver `runFullPresentation` com máquina de estados

**Data:** 2026-07-14
**Tarefa:** Implementar o caminho canônico "executar uma apresentação completa"
preservando apresentações válidas, limpando + recriando decks ausentes/parciais/inválidos,
selecionando o primeiro slide, iniciando, navegando sequencialmente e parando, com
uma máquina de estados explícita que falha seguramente em cada pós-condição.

**Scripts afetados:** `ayoa-presenter.js`, `ayoa-test-suite.js`, `ayoa-present-mode.test.js`,
`SKILL.md`, `references/ayoa-present-mode-official.md`.

### Diagnóstico

- O fluxo da skill era orientado a operações unitárias, sem um driver que cobrisse
  integralmente a especificação funcional do briefing.
- Apresentações persistidas (`presenting=true` ou deck parcial) podiam confundir
  o `preparePresentation` e iniciar a navegação fora de ordem.
- `Clear all` precisa de estratégia para reaparecer o botão **Auto-create** quando o
  deck volta a ficar vazio, simulando a UX real.
- A navegação não validava que cada clique representava um único avanço, nem que
  o último passo era detectado por `next` desabilitado.

### Correção

- `verifyPlanCompatibility`, `locatePresentControl` e `runFullPresentation` cobrem
  disponibilidade, localização progressiva e execução completa.
- `classifyExistingPresentation` classifica em `complete_presentation_available`,
  `presentation_empty`, `presentation_partial`, `presentation_invalid` e
  `state_inconclusive` usando `expectedSlideCount` opcional.
- `clearPresentationDeck` abre o menu `…`, clica em **Clear all**, valida que o mapa
  permanece intacto; `requestFullPresentation` é o `Auto-create` explícito.
- `startPresentation` + `navigatePresentation` + `hasForwardControl` +
  `confirmStepChange` formam a navegação sequencial com validação de
  `activeIndex + 1` por clique.
- `getPresentationState` devolve também `slides` para apoiar diagnóstico.
- CLI ganhou `--mode run [--expected-count N]` que imprime a timeline completa em
  JSON para validação automatizada por vídeo.
- Testes determinísticos cobrem 30 cenários: classificação, deck preservado, deck
  reconstruído, navegação com um único avanço por clique, último passo, bloqueios
  por botão ausente, Auto-create ausente, present mode já ativo, etc.

### Testes e evidências

- RED inicial: testes `runFullPresentation` falhavam por APIs inexistentes,
  closures inválidas em `page.evaluate` e `waitFor` consumindo `created.slideCount`
  como referência fora do escopo da página.
- GREEN final: 30/30 testes determinísticos passaram em `node --test
  ayoa-present-mode.test.js`; a suíte agregada com 30 regressões também passa
  em `node --test ayoa-login.test.js ayoa-navigation.test.js
  ayoa-readiness.test.js ayoa-present-mode.test.js`.
- Ajustes recentes do fixture: handler em `.slides-header-more-button` para
  capturar `dispatchEvent` no pai, recriação de `.slides-list-empty` ao esvaziar
  o deck para que `Auto-create` apareça novamente, suporte a `deckSize` variável
  e validação de seleção de estado via `presenting=true` prevenido pelo
  `state_inconclusive`.

### Lição

- Implementar o fluxo do briefing como uma máquina de estados explícita torna a skill
auditável, testável e resistente a regressões de interface. Toda divisão
"preparar/iniciar/navegar/parar" deve sempre terminar com
`presentation_completed` ou `blocked` — nunca um sucesso silencioso parcial.

---

## Caso #004 — Adaptações de fixture, `page.evaluate` sem closures e guardrail `npm test`

**Data:** 2026-07-14
**Tarefa:** Evoluir o driver `runFullPresentation` até verde, transformar
`ayoa-test-suite.js` no guardrail canônico de regressão e validar o caminho
E2E real com cookies persistidos.

**Scripts afetados:** `ayoa-presenter.js`, `ayoa-present-mode.test.js`,
`ayoa-test-suite.js`, `scripts/package.json`, `SKILL.md`.

### Diagnóstico

- `page.evaluate(predicate, argument)` envia apenas o valor serializável;
  referenciar uma closure Node dentro do `predicate` lança `ReferenceError` no
  contexto da página. A primeira tentativa usou `created.slideCount` dentro
  de um `predicate` que não conseguia vê-lo — virou bug em tempo de execução.
- O fixture original clicava no `.slides-header-more-button` para abrir o
  popper, mas o `dispatchEvent` no elemento **pai** não dispara handlers em
  ancestrais/descendentes. O Clear all só era capturado pelo handler no
  `.more-trigger` interno.
- O Clear all deixava o deck vazio sem o `slides-list-empty` reaparecer,
  fazendo `autoCreatePresentation` falhar com `no-auto-create`. No UI real, o
  Ayoa renderiza a `slides-list-empty` quando o deck zera.
- O `package.json` original tinha `"test": "echo Error && exit 1"`, então
  `npm test` falhava com blocker explícito. O guardrail só funcionava se o
  usuário soubesse invocar `node --test` manualmente.
- O `--mode run` em E2E real encontrou `presenting=true` (sessão anterior),
  bloqueou corretamente em `state_inconclusive` e encerrou com
  `presenting=false`; isso confirmou a máquina de estados antes do run completo.

### Correção

- Capturar explicitamente `created.slideCount` e `expectedSlideCount` em
  variáveis JavaScript do `runFullPresentation` antes de chamar `waitFor`;
  o `predicate` agora recebe esses números como argumento único do `page.evaluate`.
- Fixture: handler direto em `.slides-header-more-button` para capturar
  `dispatchEvent` no próprio elemento, mantendo o handler original em
  `.more-trigger` para cliques sintéticos em seu descendente.
- Fixture: ao `Clear all` esvaziar o deck, o handler recria
  `.slides-list-empty` com o botão **Auto-create**, simulando o Ayoa real
  e habilitando o caminho `requestFullPresentation` no `runFullPresentation`.
- Fixture: `deckSize` parametrizável para testar detecção do último passo
  sem hardcodar 3 slides; `expectedCount` segue governando o mapa.
- `package.json` agora define `test` como `node --test` da suíte canônica,
  com runners por arquivo (`test:login`, `test:navigation`, `test:readiness`,
  `test:present-mode`).
- `ayoa-test-suite.js` ajustou a asserção para `pass >= 30` via regex,
  evitando o efeito de junção do test runner.
- E2E real documentado: ao rodar `--mode run` após uma sessão interrompida,
  a primeira execução cai em `state_inconclusive`; a skill faz Stop e
  registra o bloqueio. **A próxima execução completa o fluxo** porque
  o painel já está liberado.

### Testes e evidências

- `npm test` verde, 30/30 testes determinísticos.
- E2E real parcial: 1ª execução bloqueou em `state_inconclusive` com
  evidência `present_mode_already_active`; o run parou com `presenting=false`
  e timeline completa até `blocked`.

### Lição

- `page.evaluate` é serializável por valor: tudo que o `predicate` precisa
  deve chegar como argumento explícito, nunca como closure ou variável de
  escopo do Node.
- O guardrail canônico de uma skill com testes é o `package.json` com `test`
  real. Sem isso, `npm test` não detecta regressão; não deixe a skill com
  script "Error: no test specified".
- Para reexecutar um driver E2E após interrupção, **sempre execute
  `--mode prepare` antes do `--mode run`** para garantir que a sessão
  comece sem estado `.presenting=true` preexistente.
- O fixture não pode esconder o que a UI real mostra: `.slides-list-empty`
  é parte do contrato e precisa reaparecer após `Clear all`.

---

## Caso #005 — Cobertura de testes auto regressivos (178 cenários)

**Data:** 2026-07-14
**Tarefa:** Expandir a suíte determinística de 33 para 178 cenários em 16 arquivos,
cobrindo i18n, estados, recuperação, flicker, ARIA, ids de slide, contrato do driver
e regressões que blindam a skill contra mudanças da UI Ayoa.

**Scripts afetados:** `ayoa-presenter.js`, `ayoa-test-suite.js`, `package.json`,
12 novos arquivos de teste + 1 helper compartilhado.

### Diagnóstico

- A suíte anterior cobria apenas o contrato do `runFullPresentation`; mudanças
  silenciosas da UI (renomeação de classes, troca de label, regressão de estado)
  passariam sem alarme.
- Cada arquivo de teste repetia a fixture do painel; o drift entre fixtures
  individuais era a principal fonte de instabilidade.
- O `package.json` da skill só conhecia o `node --test` direto; sem runner
  nomeado por arquivo, o diagnóstico de regressões era lento.

### Correção

- Helper compartilhado `ayoa-present-fixtures.js` com `installPanel(page, options)`
  paramétrico (deckSize, presenting, compact, fullscreen, nextDisabled, boundary,
  popout, labels EN/PT/ES, expectedCount, includeTogglePresenter, includeMapNodes).
- 12 novos arquivos de teste, cada um com responsabilidade única:
  - `ayoa-present-anti-regression.test.js` (15): guards contra quebras comuns
  - `ayoa-present-fallback.test.js` (14): localização por classe/ARIA/texto/tooltip
  - `ayoa-present-transitions.test.js` (11): cobertura de todos os estados
  - `ayoa-present-source-rotation.test.js` (12): preservação, recriação, idempotência
  - `ayoa-present-edge-cases.test.js` (15): `startAt` inválido, `next` desabilitado
  - `ayoa-present-i18n.test.js` (10): EN/PT/ES para `Auto-create`, `Clear all`
  - `ayoa-present-states.test.js` (12): cada estado da UI observada
  - `ayoa-present-recovery.test.js` (13): un-mount, re-render, double Stop
  - `ayoa-present-flicker.test.js` (12): double Start, advance+previous
  - `ayoa-present-presentation-id.test.js` (10): unicidade, drag, clear, fresh ids
  - `ayoa-present-aria.test.js` (9): nomes acessíveis, `aria-disabled`, bounding box
  - `ayoa-present-driver.test.js` (12): contrato programático de `runFullPresentation`
- i18n ampliado: `autoCreatePresentation` agora conhece `crear automaticamen`;
  `clearPresentationDeck` conhece `borrar todo`/`borrar`; suite `i18n` cobre
  EN, PT-BR e ES no mesmo caminho.
- `runFullPresentation` corrigido: `lastVisited` agora é definido mesmo em
  deck de 1 item (não havia `step_change_confirmed` para setar).
- `package.json` ganhou runners nomeados por arquivo (`test:anti-regression`,
  `test:fallback`, etc.) e o guardrail `npm test` continua apontando para a
  suíte canônica de 178 cenários.
- `ayoa-test-suite.js` ajustado: asserção `pass >= 178` via regex (não mais
  contagem fixa).

### Testes e evidências

- `npm test` verde: **178/178 testes determinísticos em ~25s**.
- Cada runner individual também verde:
  `test:anti-regression` 15/15, `test:fallback` 14/14, `test:transitions` 11/11,
  `test:source-rotation` 12/12, `test:edge-cases` 15/15, `test:i18n` 10/10,
  `test:states` 12/12, `test:recovery` 13/13, `test:flicker` 12/12,
  `test:presentation-id` 10/10, `test:aria` 9/9, `test:driver` 12/12.
- `ayoa-test-suite.js --test test-present-mode` confirma 178/178 e valida
  o `runFullPresentation` end-to-end.

### Lição

- Cobertura de classe-level > cobertura de unidade: cada arquivo deve
  representar uma dimensão de risco (estados, i18n, ARIA, flicker), não um
  arquivo por feature.
- Helper compartilhado > fixtures inline: centraliza o que a UI real
  produz e permite variação por opção, mantendo a paridade entre
  fixture e produção.
- Quando o teste revela que `evidence.X` ficou `null` em um caminho
  legítimo (deck de 1 item), a correção vai para a **produção** (preencher
  `lastVisited` mesmo sem avanço), não para o teste.
- Quando i18n aparece como variação de label, expandir o pattern de busca
  **e** escrever um teste por idioma, não assumir que "EN cobre PT-BR".

---

## Caso #006 — Import OPML: 4 falhas headless + caminho manual vitorioso

**Data:** 2026-07-15
**Tarefa:** Importar `~/tmp/waico-maco.opml` (33 nodes Tony Buzan, gerado pela skill `google-drive` v0.1.0) no Ayoa, depois capturar slides + gerar MP4 do mapa resultante.
**Scripts tentados:** `scripts/import-opml-v2.js`, `scripts/import-opml-v3.js`.
**Resultado:** headless falhou 4×; manual (3 cliques do user) funcionou em ~30s; capture + MP4 produziu 33 slides em 50s.

### Diagnóstico

Tentativa 1 (`import-opml-v2.js`): SPA leva 8-18s para montar; `waitForSelector('[contenteditable=true]')` no canvas expira em 30s porque o Ayoa monta nodes via Shadow DOM / custom canvas elements sem `contenteditable=true` estável.

Tentativa 2 (`import-opml-v3.js` com cookies novos `ayoa.ap/sid/user`): HTTP 200 no `app.ayoa.com`, banner HubSpot dismissed com sucesso (passo 0 OK), mas step 1 `+ / Novo projeto` falhou. O `evaluate` rodou em frame detached — o Ayoa fechou a janela antes do `evaluate` completar.

Tentativa 3 (`import-opml-v3.js` com retry de frame): cookie banner dismissed OK, mas **New Project não clicado** — `clientId=2f9ad691-…` na URL final em vez do mindmapId. Os 9 cookies (3 tracking + 3 Ayoa tracking + 3 Ayoa auth) não autenticam a sessão. O Ayoa mostrou a página **Sign in to AYOA** mesmo após `goto('app.ayoa.com')`.

Tentativa 4: idêntica à 3, mesmo resultado (URL `auth.ayoa.com/login?clientId=595e7317-…`). Os cookies salvos em `~/tmp/ayoa-cookies-test.json` (3370 bytes, 9 cookies `.ayoa.com`, incluindo `ayoa.ap/sid/user` httpOnly+secure) **não autenticam**. Causa provável: o Ayoa requer cookies `__Secure-1PSID`, `__Secure-1PAPISID`, `__Secure-3PAPISID` (sessões Google federadas) que não estão no export do browser.

Caminho vitorioso (não-script):
1. **User cola cookies** — `termux-clipboard-get` retorna 3370 chars de JSON array (9 cookies `.ayoa.com`).
2. **User importa OPML manualmente** em `https://app.ayoa.com/`:
   - Login → **`+` → Novo projeto → Mind Map → nome → OK**.
   - **Import → seleciona `Download/waico-maco.opml` → Import → Show → Open**.
3. **User me passa o URL** do novo mapa: `https://app.ayoa.com/mindmaps/469f0986-dc57-4f1d-a555-31564aa34958`.
4. **Auto-create gera 33 slides** (1 por node do OPML).
5. **`ayoa-capture-slides --wait 1200 --from 1 --to 33`** → 33 PNGs em ~50s.
6. **`ayoa-video --fps 1 --crf 23`** → MP4 947 KB, 33s, 230 kbps.
7. **`mv` → `~/storage/downloads/buzan-waico-apresentacao.mp4`** → `termux-open` no app de vídeo.

### Lição

- **Import OPML headless é intrinsecamente instável** porque depende de: cookies `__Secure-*` que não estão em exports de browser, canvas Shadow DOM sem `contenteditable`, banner HubSpot que aparece em ~3s. Recomendação oficial da skill (v1.11.0): **NÃO tentar import headless**.
- **Race condition do clipboard Android**: entre `termux-clipboard-get` calls, o conteúdo pode ser sobrescrito por outros apps. Validar shape (JSON array, count, `domain=.ayoa.com`) **antes** de `printf '%s' "$CLIP" > "$TMP"`. Validar o arquivo salvo (`JSON.parse`) depois.
- **Cookies Ayoa mínimos viáveis** (sessões em browser export): `_fbp`, `_ga`, `_ga_*`, `_gcl_au`, `_rdt_em`, `_rdt_uuid`, **`ayoa.ap`**, **`ayoa.sid`**, **`ayoa.user`**. Os 3 últimos são HttpOnly+Secure e são os que **autenticam**. Cookies de tracking sozinhos não bastam.
- **REGRA workflow do user (2026-07-15)**: nunca oferecer vídeo/PNG/MP4 de mapa criado antes; somente do mapa novo em criação. Mapas antigos podem ser usados como referência técnica de pipeline, nunca como entrega.

### Teste adicionado

Nenhum teste automatizado (a falha é observável em produção E2E, não em unit test). Pitfall documentado em `references/agent-spec-opml-import.md`, `references/ayoa-import-opml.md` e `references/ayoa-opml-agent-manual.md`.

### Métricas

- Headless: 4× falha em ~10 min total.
- Manual: 3 passos do user em ~30s; capture 50s; encode 4s; move+open 1s.
- Total end-to-end do user: **~1.5 min** vs. **~10 min** de headless falho.

---

## Caso #008 — Ayoa v2 import: `boardName:""` parece OK e produz `INTERNAL_ERROR`

**Data:** 2026-07-16
**Tarefa:** Criar no Ayoa um mapa novo sobre a final Argentina x Espanha da Copa de 2026, a partir de um OPML de 49 nós, 8 ramos.
**Script canônico:** `puppeteer-test/ayoa-create-worldcup-final.js` (resultado: `d0b3c41e-...-46e9`).

### Diagnóstico

- O fluxo de import passa por `POST /v2/uploads` (S3 PUT) e `POST /v2/import/text`. O
  segundo devolve **204 No Content** mesmo quando o body do OPML não é parseável.
- O painel Ayoa exibe "Importação Completa, 1 import failed" e o `import-jobs`
  mostra `status:COMPLETED` com `error:{code:INTERNAL_ERROR}`. O mapa não
  aparece no editor. Aparentemente o servidor alocou `boardId` e `paperId`
  mas a segunda passada do parser falhou.
- Causa raiz: o `POST /v2/import/text` recebe `boardName:""` quando o script
  clica no input errado. Ayoa tem DOIS inputs visíveis no estado inicial:
  1. `<input placeholder="Pesquisar projetos">` — searchbar global
  2. `<input placeholder="Digite o nome do seu projeto">` — modal de criação
- Confusão adicional: o React/Input controlado do Ayoa ignora `.value=`
  direto. É preciso usar o setter nativo do protótipo.

### Correção

- Heurística do seletor: regex `/digite o nome|digite um|nome do seu projeto|project name|board name/i` no placeholder/aria-label.
- Setter via `Object.getOwnPropertyDescriptor(proto, 'value').set` + dispatch de
  `input`/`change`/`blur` para que o React/state do Ayoa detecte a digitação.
- Capturar a request `POST /v2/import/text` via `page.on('request')`, parsear o
  `postData`, e abortar se `boardName !== <esperado>` — não confiar no 204.
- Polling de `GET /v2/import-jobs` propagando os headers da request POST
  (sem `X-Agent`/`X-Client-Id` o servidor retorna 400 Invalid X-Agent header
  mesmo com `x-auth-token` válido).

### Verificação

- `npm test` da skill: 197/197 verde.
- Mapa criado: `https://app.ayoa.com/mindmaps/d0b3c41e-8025-42e3-9246-787edbca46e9`.
- 49 nós esperados, `jobStatus:COMPLETED`, `apiStatus:204`, screenshot em
  `~/.ayoa-final-copa-2026-created.png`.
- Logs: `tmp/ayoa-create-run.log`, `tmp/ayoa-inputs.json`, `tmp/ayoa-import-diagnose2.json`.
- Bundle exportado para `~/storage/downloads/ayoa-import-final-copa-2026-20260716-1010/`.

### Lição

O 204 do `POST /v2/import/text` é só "aceito na fila", não "mapa pronto". Sempre
pollar `import-jobs` e validar `paperIds[0]`. Confiar em `mindmapId === null` ou
em 204 como falha é um falso negativo: a `boardId` pode existir enquanto o
`paperId` é null. Ver `references/ayoa-v2-import-api.md` para a tabela
completa de erros e o snippet de polling.

---

## Caso #007 — Sessão invalidada antes da expiração e falso sucesso do importador

**Data:** 2026-07-16
**Tarefa:** Criar no Ayoa um mapa novo sobre a final Argentina x Espanha da Copa de 2026.

### Diagnóstico

- Arquivos locais continham `ayoa.ap`, `ayoa.sid` e `ayoa.user` com `expirationDate` futura.
- Mesmo assim, o 2-hop terminou em `https://auth.ayoa.com/login?...`: a sessão havia sido invalidada pelo servidor.
- `import-opml-v3.js` continuava tentando criar o mapa na página de login e gravava `ok:true`, `mindmapId:null`, exit 0.

### Correção

- Após navegar para `app.ayoa.com`, abortar se a URL for `auth.ayoa.com/login`.
- Antes de gravar sucesso, exigir UUID em `/mindmaps/<uuid>`; sem ID, lançar erro.
- O `catch` canônico grava JSON `ok:false` e devolve exit 1.

### Verificação

- OPML validado separadamente: 49 nós, 8 ramos principais, profundidade 2.
- Fallback manual: abrir Ayoa autenticado, `Novo projeto` → `Importar` → selecionar OPML → fornecer a URL nova ao agente.

### Lição

Expiração futura é apenas metadado; o redirect observado é a fonte de verdade. Nunca declarar criação concluída sem URL canônica e UUID verificável.

---

## Caso #008 — Import OPML canônico via API direta + suíte de regressão

**Data:** 2026-07-16
**Tarefa:** Estabilizar a importação headless de OPML no Ayoa. A v3 fechou o bug de autenticação 2-hop mas expôs um novo: `1 import failed` mesmo com 204 do `/v2/import/text` quando `boardName` ficava vazio.

### Diagnóstico

- O `import-opml-v3.js` enviava `boardName=""` (input do Ayoa não refletia o `<title>` do OPML no estado React).
- O Ayoa retornava `204` em `/v2/import/text` mas `GET /v2/import-jobs?` mostrava o item com `status: 500 / code: INTERNAL_ERROR`.
- O UI mostrava apenas o toast `1 import failed` — o motivo do erro ficava no servidor.

### Correção

- `scripts/import-opml.js` (v1.15.2) usa o caminho de API direta: `POST /v2/uploads` → PUT no S3 presigned → `POST /v2/import/text` com `boardName` derivado do OPML `<title>` (ou do primeiro `<outline text=...>`) → polling em `/v2/import-jobs?` até o item do nosso `boardId` retornar `COMPLETED` → `GET https://app.ayoa.com/mindmaps/<paperId>`.
- 4 OPMLs reais movidos para `scripts/tests/fixtures/`. 3 novas suítes determinísticas (24 testes) blindam:
  - **name-match**: garante `deriveBoardName` não cai em string vazia, override vazio cai no `<title>`, OPML sem `<title>` usa primeiro outline, OPML vazio cai no default `Imported Map`.
  - **fixtures**: cada OPML real tem contagem esperada (waico-maco 33, copa 49), ramos esperados, central node esperado.
  - **cookie-shape**: `EditThisCookie` `no_restriction` → `None`; `unspecified` → `Lax`; domain sem ponto inicial recebe prefixo.

### Validação

- Mapa novo criado e verificado: `https://app.ayoa.com/mindmaps/d0b3c41e-8025-42e3-9246-787edbca46e9`.
- `npm test` na skill: 221/221 verde (~26s).

### Lição

Quando o servidor retorna 204 com toast de erro visível ao usuário, a causa real está no payload, não no transporte. Sempre derivar o `boardName` do OPML `<title>` e validar que a string não está vazia antes de enviar.

---

## Caso #009 — Capture flow: slides estáticos porque o canvas não avança sem Next

**Data:** 2026-07-16
**Tarefa:** Re-registrar o vídeo do mapa `d0b3c41e-...-46e9` (49 nós, Copa 2026) depois que o primeiro encode saiu com **61 frames** (50 slides + 11 PNGs auxiliares tipo `login-verified.png`) e o usuário reportou que a captura parecia estática.
**Diagnóstico**

- O `ayoa-capture-slides.js` antigo chamava só `navigateToSlide(page, slide.id)` e esperava `WAIT_MS=1200ms` antes de cada screenshot. Aparentava funcionar.
- A verdade: clicar no item `.slides-list-group-item` da lista lateral **não move o canvas de apresentador**. O Ayoa só desenha o slide correspondente no canvas quando o usuário clica na **seta Next** de `.slides-nav-container`. O `scrollIntoView + dispatchEvent('click')` no `<li>` seleciona o item da lista, mas a `<div class="map-canvas">` continua mostrando o slide anterior.
- Resultado prático: `slide-001.png` (screenshot após clicar slide 1) é o mesmo que `slide-002.png` (screenshot após clicar slide 2). 50% dos slides vinham duplicados, e o último era o "slide 1" congelado.
- Pitfall correlato: `goToSlideForCapture` precisa validar `activeId === slideId` **e** `panel.presenting === true` antes de capturar. Sem a segunda condição, captura o canvas do editor (não o canvas do apresentador) — o que parece correto mas é o slide errado.

**Correção** (v1.16.3, `scripts/ayoa-presenter.js`)

- `enterPresentationMode(page, {timeout=15000})` — clica `.slides-play-stop-button` em loop até `.slides-list-container.classList.contains('presenting')` ou timeout. Polling a cada 300ms para não spammar cliques.
- `advanceToSlideViaNextArrow(page, expectedId, {timeout=8000})` — clica `.slides-nav-container > :last-child` até `activeId === expectedId && presenting`. Aborta quando `nextBtn.disabled === true` (fim do deck) ou timeout.
- `goToSlideForCapture(page, slideId, {timeout=12000})` — orquestra: `enterPresentationMode` → `navigateToSlide` → wait `activeId === slideId && presenting`. Retry do `navigateToSlide` se a primeira tentativa não moveu o canvas.
- `ayoa-capture-slides.js` chama `goToSlideForCapture` por slide; em caso de `settled:false`, fallback para `advanceToSlideViaNextArrow` e loga `WARNING: N slide(s) required Next-arrow recovery` para triagem.

**Validação** (mapa `d0b3c41e-...-46e9`, 50 slides)

- 50 PNGs salvos, **0 recovery** (= todas as 50 foram capturadas no canvas correto).
- 4 amostras inspecionadas via visão: slide-001 (central node), slide-005 ("Domingo, 19 de julho" + "New York New Jersey Stadium"), slide-040 ("Narrativas da final"), slide-050 (última pergunta) — todas distintas e corretas.
- `npm test`: 236/236 verde (era 231; +5 da nova `tests/ayoa-capture-flow.test.js`).
- `pytest tests/`: 22/22 verde.
- MP4 final: `~/storage/downloads/final-copa-2026-apresentacao.mp4` (1.8 MB, 50s, h264 1440×900). Antes: 2.6 MB / 61s; diferença = 11 PNGs não-slide (`login-verified.png` etc.) que o `ayoa-video.js` contava mas não eram apresentação.

**Teste adicionado**

`scripts/tests/ayoa-capture-flow.test.js` (5 casos determinísticos, ~0.3s):

1. Fixture sem `presenting` — `enterPresentationMode` precisa clicar play.
2. Play button presente na fixture — `enterPresentationMode` consegue o toggle.
3. `nextDisabled: true` no último slide — `advanceToSlideViaNextArrow` aborta em vez de entrar em loop.
4. `presenting: true` no fixture — predicado de captura casa.
5. Deck 5 items + slide 1 selecionado por padrão — sanity check da fixture.

A fixture é a mesma `buildPanelDom` do `ayoa-present-fixtures.js` (já tinha `slides-nav-container .next` e `slides-play-stop-button`); **adicionei a flag `presentingClass` e o `slides-list-container` com/sem `.presenting`** para que a fixture pudesse ser parametrizada nos dois modos (pre/post `enterPresentationMode`).

**Lição**

1. **Em apresentadores web, clicar no item da lista NÃO move o canvas.** A "lateral" só seleciona; a "seta Next" é o que avança o slide desenhado. Mesma heurística serve para PowerPoint Online, Google Slides, Notion slides — todos têm o mesmo dual-control.
2. **A screenshot só é válida depois de `activeId === expectedId && presenting === true`**, nunca antes. Validar os dois predicados em loop, com timeout, é a regra geral.
3. **`page.screenshot()` captura o canvas do browser inteiro, não o canvas do apresentador.** Se o present mode não foi ativado, o screenshot é do editor com o mapa estático. A primeira coisa a verificar quando os slides saem "iguais" é se `presenting` está em `true` quando o screenshot é tirado.
4. **Recovery path com Next-arrow** é o fallback confiável: o Next sempre move o canvas, e sua presença/ausência é controlada pelo Ayoa (desabilitado no fim do deck). Use como oráculo de "fim do deck alcançado".

**Teste adicional manual para Ayoa 8.170.88+**

Se o Ayoa mudar a estrutura do apresentador (ex: trocar `.slides-list-container` por outro container, mudar o botão Play para `.present-toggle`), o teste quebra. Quando isso acontecer, atualizar `ayoa-present-fixtures.js` antes de mais nada — o resto da suíte é estável.

---

## Caso #010 — Multi-slide E2E: race entre `setTimeout(200)` do fixture e `select(items[0])` do teste

**Data:** 2026-07-16
**Tarefa:** Construir o guardrail E2E que prova que a captura de slides do Ayoa não é estática. O test usa Puppeteer real contra `headless_shell`, instala a fixture `buildPanelDom({deckSize:5})`, e exige que 5 PNGs consecutivos tenham SHA-256 distintos.

### Diagnóstico

- O handler `play.addEventListener('click', ...)` da fixture `ayoa-present-fixtures.js` faz `setTimeout(() => { select(items()[0]); updateNavState(); }, 200)`. Ou seja, clicar em play **agenda** um `select(items[0])` 200ms depois.
- O teste então chama `page.evaluate` para `select(items[0])` direto. As duas chamadas competem; o screenshot do slide 1 captura a renderização da segunda chamada, e o slide 2 captura a renderização idêntica.
- Resultado: 4/5 hashes únicos em vez de 5/5. Flaky: o teste passava 2 em 3 runs dependendo de qual `select` ganhou a corrida.
- Confirmação: `actual: 4, expected: 5` na linha de assertion; `collided pairs: [[1,2]]` no diagnóstico (sempre slides 1 e 2).

### Correção

- Inserir `await new Promise(r => setTimeout(r, 250))` entre o `play.click()` e o primeiro `select(items[0])` do teste. 250ms > 200ms, então o setTimeout do fixture sempre dispara antes.
- Não mudar a fixture — o setTimeout de 200ms é parte do **contrato** que o `goToSlideForCapture` real do Ayoa também respeita (transição de canvas demora ~200-500ms; é por isso que o `goToSlideForCapture` tem `timeout: 12000`).
- Adicionar log de diagnóstico que mostra `collided pairs` e os sizes dos PNGs quando o assertion falha — sem isso, o "1 in 5 fails" sem detalhe parecia bug intermitente aleatório.
- A fixture `ayoa-present-fixtures.js` também passou a re-renderizar o `map-canvas` com `data-slide-index` único por slide (espelha o que o Ayoa real faz no canvas React), tornando o teste E2E útil: as diferenças nos PNGs vêm de conteúdo real, não de cosmética.

### Validação

- `tests/ayoa-multi-slide-capture.test.js` **10/10 verde** com a ordem `play → wait(250) → select(0..4) → screenshot`.
- `npm test` 237/237 verde total; `pytest tests/` 22/22 verde.
- Hashes confirmados únicos em 10 execuções consecutivas.

### Lição

1. **SetTimeout em fixture handlers é parte do contrato**, não ruído. Quando o Ayoa real precisa de ~200ms para re-renderizar entre cliques, a fixture deve espelhar esse tempo. Testes que rodam contra fixtures com setTimeouts não podem fazer o que o handler agendado também faz — eles precisam esperar.
2. **Testes que dependem de timing precisam de diagnóstico de falha legível.** "1 in 5 fails" sem dizer qual input causou o quê é pior que não ter teste. Sempre logue `collided pairs`, `sizes`, `state` quando o assertion de uniqueness falha.
3. **Capturas "estáticas" podem ser o fixture e não o código.** Se você está testando que a captura é dinâmica mas a fixture é estática, a fixture precisa de variação **real** por slide. Adicionei `data-slide-index` no `map-node` do fixture e o teste valida que os textos "Slide N of M" aparecem nos PNGs.
4. **Compare com known-good output** (sha256 hash) é mais robusto do que comparar imagens pixel a pixel — a renderização pode variar em fontes e antialiasing sem que a "lógica" tenha mudado. O assertion `hashes.size === DECK` cobre o essencial: "cada navegação produz um canvas único".

### Receita reproduzível

```js
// 1. Aguardar 200-250ms após o play click antes do primeiro select manual.
await page.evaluate(() => document.querySelector('.slides-play-stop-button')?.click());
await new Promise(r => setTimeout(r, 250));

// 2. Para cada slide, click + wait activeId + screenshot.
for (let i = 0; i < deckSize; i++) {
  await page.evaluate((idx) => {
    const items = [...document.querySelectorAll('.slides-list-group-item')];
    items[idx]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  }, i);
  await page.waitForFunction((idx) => {
    const items = [...document.querySelectorAll('.slides-list-group-item')];
    const sel = document.querySelector('.slides-list-group-item.selected');
    return items.indexOf(sel) === idx;
  }, { timeout: 4000, polling: 100 }, i);
  const buf = await page.screenshot({ encoding: 'binary' });
  // 3. Hash + dedupe: hashes.size === deckSize.
}
```

Falha típica: `actual: 4, expected: 5` sem dizer qual par colidiu. **Sempre logue `collided pairs`** no `Error` do assertion.


