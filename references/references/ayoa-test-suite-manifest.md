# Suíte de testes auto regressivos — Ayoa Mindmap

**Versão:** 1.6.0
**Total de cenários determinísticos:** 178
**Comando canônico:** `npm test` (no diretório `scripts/`)

## Estrutura

A suíte é organizada por **dimensão de risco**, não por feature. Cada arquivo
foca em uma classe de regressão possível e compartilha a fixture em
`ayoa-present-fixtures.js`.

| Arquivo | Cenários | Foco |
|---------|---------:|------|
| `ayoa-login.test.js` | 3 | Retry no bootstrap autenticado e propagação de cookies |
| `ayoa-navigation.test.js` | 3 | Fallback para banner não-clicável |
| `ayoa-readiness.test.js` | 2 | Polling real da SPA até `editor` pronto ou timeout claro |
| `ayoa-present-mode.test.js` | 25 | Contrato do Present mode e do `runFullPresentation` |
| `ayoa-present-anti-regression.test.js` | 15 | Guards contra quebras comuns da skill |
| `ayoa-present-fallback.test.js` | 14 | Localização por classe/ARIA/texto/tooltip (EN/PT/ES) |
| `ayoa-present-transitions.test.js` | 11 | Cobertura de todos os estados da máquina |
| `ayoa-present-source-rotation.test.js` | 12 | Preservação, recriação, idempotência do deck |
| `ayoa-present-edge-cases.test.js` | 15 | `startAt` inválido, `next` desabilitado, navegação inválida |
| `ayoa-present-i18n.test.js` | 10 | EN/PT/ES para `Auto-create`, `Clear all`, run completo |
| `ayoa-present-states.test.js` | 12 | Cada estado da UI observada |
| `ayoa-present-recovery.test.js` | 13 | Un-mount, re-render, double Stop, presenting sticke |
| `ayoa-present-flicker.test.js` | 12 | Double Start, advance+previous, deterministic state machine |
| `ayoa-present-presentation-id.test.js` | 10 | Unicidade, drag, clear, fresh ids |
| `ayoa-present-aria.test.js` | 9 | Nomes acessíveis, `aria-disabled`, bounding box |
| `ayoa-present-driver.test.js` | 12 | Contrato programático de `runFullPresentation` |

## Como executar

```bash
# Suíte canônica (todos os 178 testes)
npm test

# Suites individuais
npm run test:anti-regression
npm run test:fallback
npm run test:transitions
npm run test:source-rotation
npm run test:edge-cases
npm run test:i18n
npm run test:states
npm run test:recovery
npm run test:flicker
npm run test:presentation-id
npm run test:aria
npm run test:driver
npm run test:login
npm run test:navigation
npm run test:readiness
npm run test:present-mode
```

A suíte agregada leva ~25s em headless no Termux. Suites individuais entre
1 e 14s. **Nunca execute dois runners em paralelo** — o `puppeteer-core`
usa um único Chromium e contenção faz os testes falharem com falsos positivos.

## Helper compartilhado

`scripts/ayoa-present-fixtures.js` expõe:

- `withBrowser()` — lança Chromium headless com os flags compatíveis com Termux.
- `installPanel(page, options)` — instala o painel `.slides-list-container` com:
  - `empty` (bool): deck começa vazio (com CTA `Auto-create`).
  - `deckSize` (int): número de slides.
  - `expectedCount` (int): número de map-nodes (alvo da classificação).
  - `presenting` (bool): painel com `.presenting` setado.
  - `compact` (bool): classe `.compact` aplicada.
  - `fullscreen` (bool): `#app-content.presenter-fullscreen`.
  - `nextDisabled` / `prevDisabled` (bool): estado disabled dos botões de navegação.
  - `boundary` (bool): blue-square boundary marker.
  - `popout` (bool): Dual Screen button.
  - `labels` ({add, autoCreate, clearAll}): textos localizados.
  - `includeMapNodes` / `includeTogglePresenter` (bool): controla a presença
    de elementos auxiliares.

## Padrões obrigatórios ao adicionar um novo teste

1. **Fixture primeiro**: usar `fx.installPanel(page, {...})` em vez de
   `page.setContent('<html>...')` inline. Se a fixture atual não cobre
   o cenário, estender a função `buildPanelDom` com a opção correspondente
   em vez de duplicar markup em vários arquivos.
2. **Estado global isolado**: cada `test` deve fechar/abrir `page` ou
   re-instalar o painel antes da ação, para evitar flakiness entre
   sequências de testes.
3. **Mensagens de falha explícitas**: usar
   `assert.equal(actual, expected, '<contexto legível>')` em asserções
   que se beneficiam de diagnóstico mais rico.
4. **Sem closures no `page.evaluate`**: passar o valor via argumento
   explícito (vide `pitfalls.md` §"Puppeteer + headless + fixtures").
5. **Sem `setContent` em suite paralela**: rodar suites uma a uma
   para evitar contenção de Chromium.

## Publicação no GitHub

```bash
# Com bundle em ~/tmp/<repo>-<version>/
bash scripts/publish-skill-to-github.sh
```

O script lê o PAT do clipboard via `termux-clipboard-get`, autentica `gh`,
cria o repo (se não existir) e faz `git push` + tag + release. Suporta
Fine-grained (`github_pat_*`) e Classic (`ghp_*`) PATs. **Sempre** rode
`gh auth setup-git` antes do primeiro `git push` (o script faz isso
automaticamente).

## Notas operacionais

- **Puppeteer + Termux:** `headless_shell` aarch64; cada operação ~1.2s.
- **Não rodar `pkill -f headless_shell` na mesma linha do `node --test`** —
  o padrão matcha o argv do próprio agente via `npm test`. Use
  `ps -ef | grep headless | grep -v grep | awk '{print $2}' | xargs -r kill`.
- **Suites em série, não em paralelo:** o pool de `headless_shell`
  deadlock quando 2+ suites rodam juntas. Use `notify_on_complete`
  background, uma por vez.
- **`npm test` agregado:** reserva para verificação canônica final —
  demora ~25s mas cobre tudo.

## Quando um teste falhar

1. Inspecionar o log do `npm run test:<suite>` para ver o traceback.
2. Se for regressão de seletor/label da UI Ayoa, atualizar a fixture e
   os selectors de produção **simultaneamente** (a fixture representa
   a produção; se ela desalinhou, a produção também).
3. Se for regressão na lógica de `runFullPresentation`, adicionar um
   caso em `ayoa-present-driver.test.js` antes de corrigir.
4. Se for regressão de i18n, estender o pattern de busca em
   `ayoa-presenter.js` **e** adicionar teste em `ayoa-present-i18n.test.js`.
5. Registrar o caso em `references/ayoa-learned-cases.md` com
   diagnóstico, correção e teste.
