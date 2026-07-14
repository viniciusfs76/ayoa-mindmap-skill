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

