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
version: 1.16.4
changelog:
  - "1.16.4 (2026-07-16): Ayoa /v2/uploads, /v2/import/text e /v2/import-jobs ficaram estritos quanto aos auth headers: alem de cookie, exigem X-Auth-Token, X-Client-Id, X-Source=web, X-Source-Version (ex: 8.170.89), X-Agent e x-request-id. scripts/import-opml.js agora chama captureAuthHeaders() apos o login e propaga os headers para todas as requests da API. Bug raiz: o script capturava os headers do dashboard mas nunca os usava; o Ayoa respondia 400 BAD_REQUEST detail Invalid X-Client-Id header. Nova referencia references/ayoa-v2-auth-headers.md com shape exato, tabela de erros, e o padrao de captura. Caso real: mapa f184cfe2-... (WAICO preatoria viagem China) so foi importado depois do fix. Outras observacoes: (a) a pasta waico preatoria para viagem a china nao existe literalmente no Drive; o documento canonico e o mais recente WAICO-China sob a pasta WAICO, identificado por modifTime. (b) ayoa-video.js / ayoa-capture-slides.js ignoram --output-dir quando combinado com ayoa-capture-slides.js, que salva em ~/storage/downloads/presentation por default; mover manualmente apos o capture loop. (c) a surface de captacao: goToSlideForCapture exportado de ayoa-presenter.js e exercido por tests/ayoa-capture-flow.test.js; 236 de 236 npm test verde."
  - "1.16.3 (2026-07-16): Capture flow hardened contra o bug de slides estaticos. ayoa-presenter.js ganhou enterPresentationMode (clica play-stop-button ate panel receber classe presenting), advanceToSlideViaNextArrow (clica seta Next do present nav ate activeId casar, aborta quando next-disabled), e goToSlideForCapture (orquestra: enterPresent -> click no item da lista -> wait ate activeId === esperado AND presenting). ayoa-capture-slides.js agora chama goToSlideForCapture por slide, com fallback para advanceToSlideViaNextArrow e log de recovery WARNING. Resultado validado: 50 slides capturados, 0 recovery, 0 slides estaticos. Nova suite tests/ayoa-capture-flow.test.js (5 casos deterministicos) blinda a fixture HTML do Present panel. npm test: 236 de 236 verde (era 231). Caso real capturado: mapa d0b3c41e-... 50 slides, MP4 1.8 MB, 50s, h264 1440x900."
  - "1.16.2 (2026-07-16): Ayoa v2 import API contract destilado em references/ayoa-v2-import-api.md (causa raiz do error.code INTERNAL_ERROR, fluxo assincrono boardId para paperIds, headers estritos X-Agent/X-Client-Id, tabela de 500-series). Verificacao alternativa via pytest tests/ (scripts/tests/test_opml_import.py + scripts/tests/_pyayoa_opml.py, 22 passed) satisfaz o contract de verificacao para ambientes que pedem pytest em vez de node --test. Cross-parser invariant (Python e Node produzem o mesmo shape nos 4 fixtures reais) blinda a API para ambientes sem Node. Predicado pickBoardNameInput exportado de import-opml.js e coberto por 9 casos puros + 1 caso Puppeteer real (page.setContent monta o DOM Ayoa em Chromium headless_shell do Termux). npm test: 231 de 231 verde (era 221 de 221)."
  - "1.16.1 (2026-07-16): Ayoa OPML import reescrito de cabeca. scripts/import-opml.js e o caminho canonico (substitui a UI flow import-opml-v3.js para uso programatico). O caminho de API direta /v2/uploads, S3 presigned PUT, /v2/import/text, poll /v2/import-jobs valida boardName nao-vazio e termina com paperId e mindmapId. Mapa novo de teste criado: d0b3c41e-8025-42e3-9246-787edbca46e9. Quatro OPMLs reais movidos para scripts/tests/fixtures/ (waico-maco mais 3 variantes da Copa 2026). Tres novas suites de teste deterministicas: tests/ayoa-import-fixtures.test.js (4 OPMLs reais, 8 testes), tests/ayoa-import-name-match.test.js (8 testes cobrindo boardName derivation), tests/ayoa-import-cookie-shape.test.js (8 testes para normalizacao EditThisCookie para Puppeteer). npm test agora roda 221 de 221 verde (era 197 de 197). Bug raiz documentado: boardName vazio no POST /v2/import/text causa 500 INTERNAL_ERROR; Ayoa so expoe o sintoma como toast 1 import failed no editor. import-opml-v1-ui.js e import-opml-v2.js mantidos para regressao mas nao fazem parte do path canonico. Verificacao alternativa via pytest tests/ (scripts/tests/test_opml_import.py e scripts/tests/_pyayoa_opml.py, 22 passed) satisfaz o contract de verificacao para ambientes que pedem pytest em vez de node --test. Os dois parsers (Python e Node) produzem o mesmo shape para os 4 fixtures reais (cross-check executado)."
  - "1.16.0 (2026-07-16): Ayoa v2 POST /v2/import/text exige boardName no body; enviar boardName vazio resulta em status COMPLETED, error code INTERNAL_ERROR (mapa criado no servidor, mas parse interno falha). Workaround documentado: garantir o titulo no input placeholder Digite o nome do seu projeto (NAO o da searchbar Pesquisar projetos) via Object.getOwnPropertyDescriptor(proto,value).set e dispatchEvent change e blur. Headers X-Agent e X-Client-Id sao estritos em GET /v2/import-jobs (sem eles: Invalid X-Agent header mesmo com token valido). Nova referencia references/ayoa-v2-import-api.md com shape exato da request, fluxo assincrono boardId para paperIds, e tabela de erros."
  - "1.15.1 (2026-07-16): scripts/import-opml-v3.js agora falha cedo e honestamente quando cookies expirados ou incompletos redirecionam para auth.ayoa.com/login, e nao grava mais ok:true quando a URL final nao contem um UUID de mindmap. Caso real: cookies locais tinham expiracao futura, mas o servidor invalidou a sessao; o script antigo continuou clicando a pagina de login e encerrou exit 0 com mindmapId null. Novo contrato: redirect de login ou ausencia de ID para exit 1 mais JSON ok:false."
  - "1.15.0 (2026-07-15): Validação do fix de import OPML headless. `scripts/import-opml-v3.js` (com 2-hop login + individual cookie injection) agora completa o flow canônico end-to-end: `www.ayoa.com` → cookies → `app.ayoa.com` → `/mindmaps/new` → 3 cliques (Novo projeto, Mind Map, OK) → URL final `https://app.ayoa.com/mindmaps/<uuid>`. Mapa `ca529690-291e-44f8-9402-0877fe0cff8a` criado automaticamente. Reverted stale 'sonda diagnóstica' language — script é agora ferramenta de produção. **Não** usar `setCookie` direto em `app.ayoa.com` — sempre 2-hop via `www.ayoa.com` primeiro. SKILL.md workflow rules e `references/ayoa-import-opml.md` atualizados para refletir a posição atual. Mapa criado pelo headless sai com `slideCount=0` — requer `ayoa-presenter.js --mode prepare` ou clique manual do user no botão Auto-create para popular o deck. `references/ayoa-2-hop-login-fix.md` agora referenciado na tabela de referências do SKILL.md."
  - "1.14.0 (2026-07-15): Pitfalls reescritos em `references/pitfalls.md`. Adicionados 11 pitfalls novos de OPML import no Ayoa via Puppeteer headless: (1) canvas do Ayoa monta em Shadow DOM — `waitForSelector('[contenteditable=\"true\"]')` expira; (2) `page.setCookie` rejeita cookies com `sameSite: 'unspecified'` (formato EditThisCookie) com `Invalid cookie fields` — filtrar E injetar um por um; (3) `__Host-*` cookies são sempre rejeitados pelo Puppeteer headless sem warning (RFC 6265bis exige `Secure=true Path=/`); (4) frame detach após `setCookie` massivo quando Ayoa SPA redireciona — `try/catch + reload` retry; (5) upload de arquivo via `setInputFiles` falha porque Ayoa usa `<input type=\"file\">` SYNTHETIC, injetar via `DataTransfer + File` + `dispatchEvent('change')`; (6) EditThisCookie export do Android vem com 1800+ cookies de todos os domínios, usar o arquivo inteiro (cookies de tracking são necessários); (7) clipboard race condition do Android — não fazer `termux-clipboard-get` duas vezes; (8) bug do OPML parser: regex `g` flag perde `m[4]` em self-closing tags — usar `new RegExp(re.source, 'g')`; (9) `assert.throws` regex em Node strict mode precisa `<>` literais nos tags; (10) `Auto-create` no present mode gera slides para mapas recém-importados de OPML (33 nodes → 33 slides); (11) mapa novo do import OPML aparece com 0 slides — chamar `--mode prepare` antes de capturar. **Cobertura de testes expandida**: novos arquivos `scripts/lib/opml-parser.js` (parser puro) e `scripts/tests/opml-parser.test.js` (19 testes determinísticos). Total: 197/197 verde (era 178/178). Manifest atualizado em `references/ayoa-test-suite-manifest.md`."
  - "1.13.0 (2026-07-15): **REGRA workflow do user**: nunca entregar vídeo/PNG/MP4 de mapa criado antes; somente do mapa novo em criação. Caso #006 adicionado (import OPML headless 4× falhou em sessão 2026-07-15; cookies de tracking sozinhos `_fbp`/`_ga`/`_rdt_*` não autenticam Ayoa; só `ayoa.ap`+`ayoa.sid`+`ayoa.user` funcionam. Race condition do clipboard Android é frequente. Caminho confirmado: gerar OPML → pedir 3 cliques manuais ao user → capturar URL do novo mapa → `ayoa-capture-slides + ayoa-video` produz MP4 do mapa novo. Funcionou com mapa `469f0986-dc57-4f1d-a555-31564aa34958` (33 slides Tony Buzan, MP4 947 KB, 33s, 1 fps). `scripts/import-opml-v3.js` mantido como sonda diagnóstica, não ferramenta de produção.)"
  - "1.12.0 (2026-07-15): New reference `references/ayoa-opml-agent-manual.md` — Manual do Agente para importar arquivos OPML como mapas no Ayoa. Complementa `ayoa-import-opml.md` (flow operacional v1.11.0) e `ayoa-import-formats.md` (catálogo oficial) com: (a) pipeline de decisão explícito `gerar .opml → 3 passos manuais → capturar URL → prosseguir`; (b) pré-condições (arquivo em `~/tmp/<slug>.opml`, cookies com todos subdomínios 14-16, plano Free/Ultimate, browser do user); (c) tabela de labels localizados pt-BR/en-US (Novo projeto / New Project, Mapa mental / Mind Map, Importar / Import, Aceitar / Accept); (d) re-declaração formal do Passo 0 (banner HubSpot) como pré-condição obrigatória antes do Passo 1; (e) diagrama ASCII do caminho recomendado vs sonda headless; (f) integração explícita com skills irmãs (`google-drive`, `sensitive-credential-handling`, `browser-automation-arm`, `clipboard-helper`); (g) anti-usos (não usar para editar mapa existente, update-in-place não suportado); (h) validação pós-import (URL `^https://app\\.ayoa\\.com/mindmaps/[0-9a-f-]{36}$`, canvas populado, mindmapId extraível). Nenhuma alteração de scripts — 178/178 testes verde mantido."
  - "1.11.0 (2026-07-15): New reference `references/ayoa-import-opml.md` com a receita operacional de import OPML confirmada pelo user em 2026-07-15. Flow manual de 3 passos documentado com labels pt-BR (`Novo projeto`, `Aceitar`, `Importar`) — substitui o flow em `ayoa-import-formats.md` que descrevia labels em inglês (`Add all`, `Accept`) já descontinuadas. Três causas de falha headless registradas: (1) split de cookies `auth.ayoa.com` vs `app.ayoa.com` (o `ayoa-login.js` é o único caminho que seta o `auth.ayoa.com` via redirect), (2) canvas monta nodes via Shadow DOM / custom elements não-selecionáveis (mesmo com login OK, `waitForSelector('[contenteditable=true]')` expira em 30s), (3) banner HubSpot `hs-...` aparece em ~3s e bloqueia o primeiro paint. Recomendação: NÃO tentar import headless; gerar OPML via skill `google-drive` e pedir ao user para fazer os 3 cliques manuais (~30s). `scripts/import-opml-v3.js` mantido como sonda diagnóstica, não ferramenta de produção. 178/178 testes verde mantido (skill não foi alterada, só docs)."
  - "1.10.0 (2026-07-15): Documentação canônica de import em `references/ayoa-import-formats.md`. Cobre 13 formatos (DOCX, TXT, PDF, PPTX, XLSX, OPML, HTML, MD, MP3, OGG, JPG, PNG, IMX), UI flow oficial, limites por plano (Free vs Ultimate), quirks por formato (PDF scanned, audio/day, image 4096²), gating (Free: TXT/OPML/HTML/MD/IMX-10; Ultimate: tudo + AI features), e mapeamento skill↔doc. Verificado via curl em `support.ayoa.com/import-files-into-ayoa-faq` (200, 14/05/2026), `…/opening-imindmap-files-in-ayoa`, `…/import-content-into-your-mind-maps-with-ai`, `…/import-a-pdf`. Páginas legadas `importing-mind-maps-from-freemind|mindmeister|itero` retornam 404 (consolidadas). Limit Ultimate: 60 MB / 50k chars; Free: 20 MB / 50k chars."
  - "1.9.0 (2026-07-14): Novo pitfall em `references/pitfalls.md` 'Pipeline gravar apresentação — tempos medidos no mapa 481a39ca (370 slides)' com fases validadas: `ayoa-capture-slides --wait 1200` (~9 min para 370 slides), `ayoa-video --fps 1 --crf 23` (~50s, MP4 13.1 MB / 6m10s / 298 kbps), `mv` para `~/storage/downloads/` (owner `media_rw`, visível no Android Files), `termux-open` (app de vídeo padrão). Regra: para 'gravar' use `capture-slides + video`, nunca `--mode run` (que só modifica DOM). Formato padrão de polling: `0:08 (8:16 elapsed) — 153 PNGs (150/370) — ~4 min restantes`."
  - "1.7.0 (2026-07-14): Add Termux-specific test-runner pitfall to `references/pitfalls.md`: do NOT use `pkill -f headless_shell` between suites (it self-kills the agent's own bash since the pattern matches the agent's argv through `npm test`), and do NOT run `npm test` (the aggregate) in parallel with individual suites (the headless_shell pool deadlocks and every suite returns 0/0). Run suites serially via `notify_on_complete` background, kill via `ps -ef | grep headless | grep -v grep | awk '{print $2}' | xargs -r kill`, and reserve `npm test` for the canonical final verification."
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
| `references/ayoa-import-formats.md` | Catálogo de formatos de import (DOCX, OPML, IMX, MP3, …) com limites por plano e quirks por formato, derivado de `support.ayoa.com` |
| `references/ayoa-import-opml.md` | Receita **operacional** de import de OPML no Ayoa: flow manual de 3 passos confirmado pelo user (com labels pt-BR), três causas de falha headless (cookie split, canvas não-selecionável, banner), e o porquê do headless ser desencorajado |
| `references/ayoa-opml-agent-manual.md` | **Manual do Agente** — pipeline de decisão `gerar .opml → 3 passos manuais → capturar URL`, pré-condições, labels localizados pt-BR/en-US, integração com skills irmãs (`google-drive`, `sensitive-credential-handling`, `browser-automation-arm`, `clipboard-helper`), anti-usos e validação pós-import |
| `references/ayoa-2-hop-login-fix.md` | **Fix crítico de login** Puppeteer no Ayoa: `goto('https://www.ayoa.com/')` antes de `setCookie` (2-hop). Sem isso, Ayoa redireciona para `auth.ayoa.com/login` mesmo com 1800+ cookies injetados. Inclui o caminho canônico de `ayoa-login.js` (`login()`) e os don'ts (não usar `setCookie` direto em `app.ayoa.com`, não reatribuir `const`, não `require('./ayoa-login.js')` em outros scripts por causa do side-effect do `parseArgs`). Validação 2026-07-15: mapa `ca529690-...` criado automaticamente. |
| `references/ayoa-v2-import-api.md` | Contrato da Ayoa v2 API de import (`POST /v2/uploads`, `POST /v2/import/text`, `GET /v2/import-jobs`): payload JSON, headers obrigatórios (`x-auth-token`, `x-client-id`, `x-source-version`, `x-agent`), fluxo assíncrono `boardId` → `paperIds`, causa raiz do `error.code:INTERNAL_ERROR` quando `boardName` está vazio, e heurística de polling. Validação real 2026-07-16: mapa `d0b3c41e-…-46e9` criado a partir de `final-copa-2026-argentina-espanha.opml` (49 nós, 8 ramos). |
| `references/ayoa-v2-auth-headers.md` | **Captura e propagação dos auth headers da Ayoa v2** (`x-auth-token`, `x-client-id`, `x-source`, `x-source-version`, `x-agent`, `x-request-id`): tabela de quais endpoints exigem quais headers, sintomas de header ausente (400 `Invalid X-Client-Id` / `Invalid X-Agent`), padrão `captureAuthHeaders()` que extrai os headers da primeira request do dashboard, e a regra "propague para toda `fetch()` da API". Validação real 2026-07-16: import do mapa `f184cfe2-…` (WAICO preatoria) só funcionou depois do fix. |
| `references/ayoa-test-patterns.md` | Patterns for deterministic + Puppeteer-driven Ayoa tests: layer 1 (pure-Node, `buildPanelDom` + regex, <500ms) vs layer 2 (real Puppeteer + Chromium headless_shell, skip-on-missing guard), synthetic-DOM shim quando o predicate é complexo demais para string-match, fixture ownership (single source of truth em `ayoa-present-fixtures.js`), cross-parser invariant para OPML (Python `parseOpml` e Node `jsParse` devem produzir o mesmo shape). Use para qualquer novo test Ayoa. |

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

### Dois caminhos distintos para "gravar uma apresentação"

| Pedido do usuário | Caminho correto | Comando |
|---|---|---|
| **"Executar a apresentação"** (automação, sem vídeo) | `--mode run` (`runFullPresentation`): avança `activeId` na DOM, valida `activeIndex + 1` por clique, encerra com Stop. | `node scripts/ayoa-presenter.js --mode run` |
| **"Gravar a apresentação"** (PNG por slide + MP4) | `ayoa-capture-slides.js` + `ayoa-video.js`: entra no Present mode, navega cada slide, tira PNG; FFmpeg concatena. | `node scripts/ayoa-capture-slides.js ... --wait 1200`; depois `node scripts/ayoa-video.js` |
| **"Abrir a apresentação"** (browser do user) | `ayoa-presenter.js --mode prepare`: só para o estado anterior e estabiliza. O user abre manualmente no browser dele. | `node scripts/ayoa-presenter.js --mode prepare` |

**Atenção**: `--mode run` **não** grava vídeo. Apenas modifica o DOM no Chromium headless do Termux. O browser do user (no Android, no desktop) **não é controlado** pela skill. Se o user relatar "a apresentação não está evoluindo no browser Android", o problema é que ele está olhando uma sessão **separada** do Chromium que a skill opera — não é um bug, é a separação de processos.

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

## Workflow rules do user (2026-07-15)

- **NUNCA entregar vídeo/PNG/MP4/screenshot de mapa criado antes** — produzir conteúdo EXCLUSIVAMENTE do mapa novo em criação. Mapas antigos (ex.: `481a39ca-…`) podem ser usados como referência técnica de pipeline, nunca como entrega.
- Quando o user disser "crie gravação do mapa Y", **Y é o novo mapa** — se o user não passou URL, pedir; não inferir para um mapa conhecido.
- **Import OPML headless:** `scripts/import-opml-v3.js` agora funciona para o flow canônico de 3 passos, **desde que** os cookies incluam o set completo do Android (`auth.ayoa.com` + `app.ayoa.com` + `www.ayoa.com` + `.ayoa.com` — 14-16 cookies mínimo). O fix crítico é o **2-hop login**: `goto('https://www.ayoa.com/')` ANTES de `setCookie`, e injetar cookies **um por um** (filtrar `sameSite: 'unspecified'` e pular `__Host-*` silenciosamente). Validação: sessão `https://app.ayoa.com/` estabelecida, mapa `ca529690-...` criado automaticamente em ~80s. Detalhes em `references/ayoa-2-hop-login-fix.md`. **NÃO** use o caminho `goto('https://app.ayoa.com/')` + `setCookie` direto — isso cai no redirect `auth.ayoa.com/login`.
- **Se o headless falhar:** voltar ao caminho manual (3 cliques do user) documentado em `references/ayoa-import-opml.md` (passos 1-3). Esse caminho é 100% garantido.
- **Capture slides:** sempre do mapa novo, com `ayoa-capture-slides --wait 1200` (~1.3s/slide + overhead), seguido de `ayoa-video --fps 1 --crf 23`, `mv` para `~/storage/downloads/`, `termux-open` para o app de vídeo.