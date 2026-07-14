---
name: ayoa-mindmap
description: >
  Skill especializada em Ayoa.com — autenticação, navegação em mapas mentais,
  criação/edição/remoção de nós, modo apresentação, captura de slides, geração
  de vídeo, e ciclo adaptativo de aprendizado com testes automatizados.
  Cobre todo o pipeline: login por cookies → mindmap → presenter → slides → vídeo
  → verificação visual → registro de erros → melhoria contínua.
when_to_load: >
  Quando o usuário mencionar Ayoa, mindmap, mapa mental, apresentação de slides,
  gravação de apresentação, ou qualquer fluxo envolvendo app.ayoa.com.
  Também carrega quando o usuário pedir automação visual com Puppeteer + gravação
  de vídeo (skill detecta Ayoa pelo domínio e roteia automaticamente).
version: 1.6.0
changelog:
  - "1.6.0 (2026-07-14): Cobertura de testes auto regressivos expandida para 178 cenários determinísticos em 16 suites (anti-regression, fallback, transitions, source-rotation, edge-cases, i18n EN/PT/ES, states, recovery, flicker, presentation-id, aria, driver). Helper compartilhado em `ayoa-present-fixtures.js`. Correções de i18n (espanhol adicionado a Auto-create e Clear all) e de máquina de estados (lastVisited em deck de 1 item)."
  - "1.5.0 (2026-07-14): Cruzamento com pesquisa oficial: confirma `support.ayoa.com` como domínio correto, registra `sitemap.xml` (262 URLs) e `release notes` (45 entradas) como fontes; inclui `features/` (WP-JSON) e detalha sinais visuais documentados (botão Present azul, blue squares) com seus equivalentes no Ayoa Web 8.170.88. Mapeia `+Add`/`Add all` → `Auto-create`; `Live share` (2024) vs `Dual Screen` (atual) como recursos distintos. 33 testes determinísticos (boundary marker, ARIA `Presenting Mode`, `expectedSlideCount=null` como dica de preservação)."
  - "1.4.0 (2026-07-14): Driver `runFullPresentation` com máquina de estados explícita. Detecta o painel já em Present e bloqueia em `state_inconclusive`; preserva deck completo; limpa + recria deck ausente/parcial/inválido. Seleciona primeiro slide, inicia, navega pela seta de avanço com `confirmStepChange`, valida `activeIndex + 1` por clique, e para preservando o deck. CLI `--mode run [--expected-count N]`. 30 testes determinísticos."
  - "1.3.0 (2026-07-14): Política adaptativa explícita: textos, posições e seletores históricos não são invariáveis; matriz versionada de equivalências entre documentação e UI Ayoa Web 8.170.88."
  - "1.2.0 (2026-07-14): Present mode real: preparação idempotente, Auto-create multilíngue, start/stop verificados, navegação anterior/próximo, compact/fullscreen com cache de deck, retries de SPA/login."
  - "1.1.0 (2026-07-14): Fontes oficiais do Present mode — domínio `support.ayoa.com` (não `help.ayoa.com`); fluxo oficial do Presenting Mode (Ayoa Ultimate) consolidado em `references/present-mode-official.md`."
  - "1.0.0 (2026-07-14): Release inicial. Login por cookies, navegação de mapas mentais, presenter mode, captura de 370 slides, geração de vídeo MP4, ciclo adaptativo de aprendizado com testes."
---

# Ayoa Mindmap — Skill Especializada

## Visão geral

Skill completa para operar o Ayoa.com (app.ayoa.com) de forma headless via Puppeteer no Termux/Android. Executa tarefas de mapa mental e registra evidências visuais em vídeo.

## Domínios oficiais (verificado 2026-07-14)

| Recurso | Domínio correto | Notas |
|---|---|---|
| App (editor) | `app.ayoa.com` | SPA React pesado; carregar 8-18s |
| Auth (login) | `auth.ayoa.com` | Cookies devem ter `domain: ".ayoa.com"` |
| Marketing | `www.ayoa.com` | WordPress, conteúdo via `/wp-json/wp/v2/pages/<id>` |
| **Help Center** | **`support.ayoa.com`** | HubSpot KB. **`help.ayoa.com` NÃO EXISTE** (DNS não resolve) |
| Release Notes | `opengenius-marketing.s3.us-east-1.amazonaws.com/announcements/prod/changelog.json` | Feed JSON; 45 entradas (2025-02 → 2026-06) |
| Marketing sitemap | `www.ayoa.com/sitemap.xml` (WP) | Acessível mas não usado para features |
| Help sitemap | `support.ayoa.com/sitemap.xml` | 262 URLs; **NÃO contém Present mode** (a página canônica foi removida, ver `references/present-mode-official.md`) |

**Pitfall:** se você receber uma URL `help.ayoa.com/...` de qualquer fonte, troque para `support.ayoa.com/...` — o `help` é subdomínio inexistente.

## Present mode — visão oficial (resumo executivo)

**Onde a doc canônica mora:** A página oficial `https://support.ayoa.com/present-your-mind-maps` foi **removida** (404 em 2026-07). O conteúdo está preservado no **Wayback Machine** e referenciado em `references/present-mode-official.md`. SEMPRE carregar essa referência antes de testar/modificar o pipeline de apresentação.

**Fatos vinculantes (citáveis em testes):**
- **Plano:** "Present mode is exclusive to **Ayoa Ultimate**" — free users NÃO veem o botão Present.
- **Escopo:** Mind Maps e Whiteboards. Disponível em **Mind Map View** (não Radial, Capture ou Task boards).
- **Estado do botão Present:** canto superior direito; **highlighted blue** quando modo ativo.
- **Navegação entre slides:** setas direcionais no menu OU teclado (`arrows` / `space bar`).
- **Slides salvos:** a apresentação **persiste entre sessões** — pode ser reiniciada depois.
- **Live share (v2024):** botão que sincroniza o item atual em tempo real para membros do board nas próprias contas deles.

**Aliases DOM a procurar (em ordem de probabilidade):**
- Botão principal: `button[aria-label*="Present"]`, `.toggle-presenter`, `[data-testid*="present"]`
- Menu lateral: `.present-menu`, `.slides-list`, `.presentation-panel`
- Ações: `+Add`, `Auto-create`, `Clear all`, `Start presenting`, `Stop presenting`
- Controles: collapse button, full-screen button, live-share button

**Adjacente — Auto-Focus vs Present mode:**
- **Auto-Focus** (Settings → Display Options → slider `Auto Focus` com estados `OFF / ON / ON+`) é uma alternativa manual que colapsa todos os branches e mostra um nível (ON) ou todos os descendentes (ON+) ao clicar. Usado manualmente.
- **Present mode** é o modo formal: você constrói uma lista explícita de branches (`+Add`/`Auto-create`), ajusta zoom por item via "blue squares of the boundary", e navega com Start presenting → setas → Stop presenting.
- Atalho `Ctrl/Cmd + ←/→` colapsa/expande branches individuais.

## Política adaptativa (do usuário, 2026-07-14)

Nomes, textos, posições e seletores vindos da documentação disponível **podem diferir**
da interface atual. Não trate referências históricas como invariáveis.

- Antes de cada automação, inspecione o DOM atual e identifique o controle por
  **função e estado semântico**; textos, classes e posições são pistas, não contrato.
- A interface muda; registre equivalências novas em
  `references/ayoa-interface-equivalences.md` e atualize
  `references/present-mode-version-matrix.md`; bumpe a skill.
- Quando a fonte divergir da UI atual, **priorize a UI para seletores/automação** e
  use a fonte como contrato de intenção ou baseline de versão.
- Quatro categorias, nunca misturadas: **histórico documentado**, **documentação atual**,
  **UI atual observada**, **inferência**.
- Botão ausente: verificar primeiro **entitlement/plano** (`Ayoa Ultimate`,
  `Web/Desktop`), não assumir quebra de seletor.

## Princípio central: ciclo adaptativo

A cada nova tarefa, a skill segue este pipeline:

1. **Carregar conhecimento** — ler `references/ayoa-learned-cases.md`, `references/pitfalls.md`, `references/present-mode-official.md`, `references/ayoa-present-mode-official.md`, `references/present-mode-version-matrix.md` e `references/ayoa-interface-equivalences.md`
2. **Executar** — usar `scripts/` para realizar a tarefa
3. **Registrar evidências** — screenshots + vídeo + logs
4. **Verificar visualmente** — validar resultado por screenshot/análise de DOM
5. **Diagnosticar erros** — identificar causa raiz
6. **Extrair aprendizado** — registrar em `ayoa-learned-cases.md`
7. **Criar teste** — reproduzir o novo caso
8. **Corrigir scripts** — aplicar a correção nos scripts relevantes
9. **Validar regressão** — rodar `scripts/ayoa-test-suite.js`
10. **Versionar** — incrementar `version` em SKILL.md

## Arquivos da skill

### Scripts

| Script | Função |
|--------|--------|
| `scripts/ayoa-login.js` | Login por cookies do Ayoa |
| `scripts/ayoa-navigate.js` | Navegar entre nós do mindmap |
| `scripts/ayoa-presenter.js` | Driver de alto nível: preparação, start/stop, navegação, compact/fullscreen e `runFullPresentation` com máquina de estados |
| `scripts/ayoa-present-mode.test.js` | Testes determinísticos do contrato do Present mode |
| `scripts/ayoa-login.test.js` | Regressão de retry no bootstrap autenticado |
| `scripts/ayoa-navigation.test.js` | Regressão do fallback para banner não clicável |
| `scripts/ayoa-readiness.test.js` | Polling real da SPA até editor pronto ou timeout claro |
| `scripts/ayoa-capture-slides.js` | Capturar todos os slides como PNG |
| `scripts/ayoa-video.js` | Gerar vídeo MP4 a partir dos PNGs |
| `scripts/ayoa-test-suite.js` | Suite completa de testes |
| `scripts/ayoa-learn.js` | Ciclo adaptativo: diagnosticar, aprender, testar |

### Referências

| Arquivo | Conteúdo |
|---------|----------|
| `references/ayoa-ui-map.md` | Mapa DOM do Ayoa (toolbars, buttons, modals, painéis) |
| `references/pitfalls.md` | Armadilhas conhecidas e suas soluções; primeira seção é **Puppeteer + headless + fixtures** (genérico, class-level — `page.evaluate` sem closures, `dispatchEvent` no próprio nó, fixture espelha UI real, `package.json` com `test` real) |
| `references/ayoa-learned-cases.md` | Casos aprendidos em execuções reais |
| `references/present-mode-official.md` | Documento oficial consolidado/histórico, gating Ultimate e fluxo completo preservado |
| `references/ayoa-present-mode-official.md` | Contrato vivo validado contra Ayoa Web 8.170.88: DOM, atalhos, compact/fullscreen e critérios E2E |
| `references/present-mode-version-matrix.md` | Matriz histórica→atual: termos, controles, seletores e regra de automação por conceito |
| `references/ayoa-interface-equivalences.md` | Procedimento adaptativo, divergências de comportamento, posições diagnósticas e critérios para registrar nova equivalência |

## Objetivo funcional canônico

Quando a tarefa for **executar uma apresentação completa** de um mapa, a skill deve:

1. Abrir o mapa correto (autenticação + `navigateToMindmap` com readiness real).
2. Abrir a `present window` (painel Apresentador, idempotente).
3. Avaliar a apresentação existente e classificá-la em
   `complete_presentation_available | presentation_missing | presentation_empty |
   presentation_partial | presentation_invalid | generation_in_progress |
   state_inconclusive | feature_unavailable`.
4. **Preservar** uma apresentação completa; **limpar + recriar** quando ausente,
   vazia, parcial ou inválida.
5. Selecionar o primeiro item da sequência.
6. Clicar `Start`/`Start presenting` (ou equivalente atual) uma única vez.
7. Confirmar a entrada no Present mode pelo estado da UI, não por coordenada.
8. Navegar sequencialmente pela seta de avanço, **um único passo por clique**.
9. Confirmar cada transição por mudança de slide ativo + `activeIndex + 1`.
10. Detectar o último passo por `next` desabilitado/ausente e `activeIndex === slideCount - 1`.
11. Encerrar com `Stop presenting`/`Stop` (ou equivalente), preservando o deck.
12. Comprovar o funcionamento por vídeo real e classificar cada passo do
    resultado conforme o `verdict` do briefing.

Drivers e máquina de estados detalhados em
`references/ayoa-present-mode-official.md` (seção "Driver canônico
`runFullPresentation`").

### Templates

| Arquivo | Uso |
|---------|-----|
| `templates/ayoa-task-template.js` | Template para novas tarefas no Ayoa |

## Pré-requisitos

- Chromium headless_shell (`$PREFIX/lib/chromium/headless_shell`)
- puppeteer-core (npm)
- ffmpeg (para geração de vídeo)
- Cookie de sessão Ayoa (dump formato EditThisCookie)

## Fluxo de uso típico

```bash
# Preparar e validar o deck (abre o Presenter e para estado antigo)
node scripts/ayoa-presenter.js --cookies ~/tmp/ayoa-cookies.json \
  --target https://app.ayoa.com/mindmaps/<uuid> --mode prepare

# Entrar no Present mode real, navegar com a seta e parar
node scripts/ayoa-presenter.js --cookies ~/tmp/ayoa-cookies.json \
  --target https://app.ayoa.com/mindmaps/<uuid> --mode present --action next \
  --compact --fullscreen --screenshot ~/ayoa-present.png

# Driver completo com máquina de estados (caminho canônico)
node scripts/ayoa-presenter.js --cookies ~/tmp/ayoa-cookies.json \
  --target https://app.ayoa.com/mindmaps/<uuid> --mode run \
  --expected-count 370 --screenshot ~/ayoa-run.png

# Captura/vídeo quando solicitado
node scripts/ayoa-capture-slides.js --cookies ~/tmp/ayoa-cookies.json \
  --target https://app.ayoa.com/mindmaps/<uuid>
node scripts/ayoa-video.js --input ~/storage/downloads/presentation

# Regressão determinística + E2E autenticado
node --test scripts/ayoa-login.test.js scripts/ayoa-navigation.test.js scripts/ayoa-readiness.test.js scripts/ayoa-present-mode.test.js
node scripts/ayoa-test-suite.js --cookies ~/tmp/ayoa-cookies.json --test test-presenter
```

## Instruções para o agente

Ao carregar esta skill:

1. SEMPRE ler `references/pitfalls.md`, `references/ayoa-learned-cases.md`, `references/present-mode-official.md`, `references/ayoa-present-mode-official.md`, `references/present-mode-version-matrix.md` e `references/ayoa-interface-equivalences.md` primeiro
2. SEMPRE validar que os cookies de sessão não expiraram antes de usar
3. SEMPRE verificar screenshots após cada operação crítica
4. SEMPRE registrar novos casos aprendidos em `ayoa-learned-cases.md`
5. SEMPRE rodar `ayoa-test-suite.js` após modificar scripts
6. SEMPRE que o usuário pedir pesquisa/auditoria do Present mode ou de mudanças no Ayoa, conferir primeiro a referência `present-mode-official.md` antes de buscar fontes externas

## Integração com skills irmãs

- `browser-automation-arm` → setup de Puppeteer + Chromium no Termux
- `sensitive-credential-handling` → manuseio seguro de cookies
- `clipboard-helper` → leitura de cookies do clipboard