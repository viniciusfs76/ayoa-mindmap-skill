# Manual do Agente — Importar arquivos OPML como mapas no Ayoa

> Reference operacional para o agente: pipeline "tenho um `.opml`, gere um mapa no Ayoa".
> Captura os **3 passos manuais confirmados pelo user (2026-07-15)**, as
> **três causas-raiz de falha headless**, e o **papel das skills irmãs**.
> Complementa — não substitui — `references/ayoa-import-formats.md`
> (catálogo oficial de formatos) e `references/ayoa-import-opml.md`
> (receita operacional canônica v1.11.0).

## Visão geral

Quando o agente recebe um `.opml` (de qualquer fonte: `google-drive`,
`xmind` exportado, `freemind`, exportação de outro mapa mental, ou um
OPML escrito à mão), o caminho de menor atrito é **gerar o arquivo e
pedir ao user para fazer 3 cliques no browser**. O caminho headless
existe como **sonda diagnóstica**, não como ferramenta de produção.

## Pré-condições

1. **Arquivo `.opml` presente em disco** (`~/tmp/<slug>.opml` é o
   convention). Para gerar do zero a partir de um Google Doc, use a
   skill `google-drive` (export → OPML → grava em `~/tmp/`).
2. **Cookies de sessão Ayoa válidos** (dump EditThisCookie com todos
   os subdomínios `auth.ayoa.com` + `app.ayoa.com` + `www.ayoa.com` +
   `.ayoa.com` — 14-16 cookies; um dump de 9 cookies NÃO basta).
3. **Plano Free ou Ultimate** — ambos importam OPML. Free tem limite
   de 20 MB / 50k chars; Ultimate vai a 60 MB / 50k chars.
4. **Browser aberto pelo user** (Chromium do Termux é separado da
   sessão Android do user; não tente controlar o browser dele).

## Os 3 passos manuais (canônicos, ordem fixa)

> User confirmou em 2026-07-15 que esta é a sequência exata. Os
> labels vêm do locale **pt-BR** (que é o default do user).

### Passo 1 — Criar mapa novo

- Em `https://app.ayoa.com/`, clicar no botão **`+`** na barra
  superior (ou **`Novo projeto`** em pt-BR, **`New Project`** em
  en-US).
- Abre-se um modal centralizado.

> **Pitfall:** labels são localizados. Procurar por `"new project"`
> (en) num browser pt-BR **não** acha o botão. Sempre comparar
> `textContent.trim()` e `aria-label`.

### Passo 2 — Modal: nome, tipo, OK

Dentro do modal:

1. **Digitar** o nome do mapa no input de texto central (vai virar o
   texto do nó central).
2. **Selecionar o primeiro tile** ("Mind Map" / "Mapa mental").
   - **NÃO** escolher "Radial Map" / "Whiteboard" — abrem editor
     diferente e o import não vai para o canvas de Mind Map.
   - "Mind Map" é sempre o **primeiro** tile (esquerda) em Ayoa Web
     8.170.88. Sem navegação por setas entre tiles.
3. Clicar **OK** / **Create** / **Criar** (varia por locale).

> **Pitfall:** "o primeiro" importa. Mind Map é sempre o primeiro;
> pegar o segundo (Radial) requer começar do zero.

### Passo 3 — Editor: Import → upload → OK

Com o mapa novo aberto e o canvas vazio:

1. Clicar no botão **`Import`** (NÃO "Add all" — esse label é legado
   do Help Centre antigo e **não existe** na UI atual).
2. Arrastar o `.opml` para a caixa de upload (ou clicar e selecionar
   do dispositivo).
3. Clicar **OK** para confirmar.
4. Ayoa renderiza a árvore importada no canvas.
5. A URL agora tem o `mindmapId`: `https://app.ayoa.com/mindmaps/<uuid>`.

> **Pitfall:** "Import" ≠ "Add all". Procurar `"add all"` falha em
> 2026+. O label atual é **`Import`** (en) / **`Importar`** (pt-BR).

## Labels localizados (referência rápida)

| English | Portuguese (BR) | Passo / função |
|---|---|---|
| `New Project` | `Novo projeto` | Passo 1 — abre o modal |
| `Mind Map` | `Mapa mental` | Passo 2 — tile **correto** |
| `Radial Map` | `Mapa radial` | Passo 2 — **NÃO** escolher |
| `Whiteboard` | `Quadro` | Passo 2 — **NÃO** escolher |
| `Create` / `OK` | `Criar` / `OK` | Passo 2 — confirma modal |
| `Import` | `Importar` | Passo 3 — abre upload |
| `Accept` | `Aceitar` | Banner HubSpot (passo 0) |
| `Decline` | `Recusar` | Banner HubSpot (passo 0) |

Todos esses elementos são `<button>` com `class` que muda entre
builds. **Sempre casar por `text()` ou `aria-label`, nunca por classe.**

## Passo 0 (pré-condição) — Dismiss cookie banner

Antes de tudo, na primeira renderização de `https://app.ayoa.com/`
após injeção de cookies, aparece um modal HubSpot centralizado
"To improve your experience..." com `Accept` / `Decline`. O botão
**só aparece ~3 s depois do `domcontentloaded`** (script HubSpot
executa depois do Ayoa SPA montar). Sem dismiss:

- O `waitForSelector('button:has-text("Novo projeto")')` corre
  contra o banner e expira em 30 s.
- Mesmo que Step 1 clique funcione, o banner intercepta clicks.

```javascript
// Antes de qualquer flow step:
await page.evaluate(() => {
  const all = [...document.querySelectorAll('button, [role="button"]')];
  for (const el of all) {
    const t = (el.textContent || '').trim().toLowerCase();
    if (t === 'accept' || t === 'aceitar' || t.includes('aceitar todos') || t.includes('accept all')) {
      el.click();
      return;
    }
  }
});
await sleep(1000);
```

Já documentado em `references/pitfalls.md` ("Cookie banner bloqueia
visão") — aqui o ponto é que para o flow de import, **passo 0 deve
rodar antes do passo 1**, não intercalado.

## Por que headless falha (três causas-raiz compostas)

### 1. Split de cookies — `app.ayoa.com` sozinho não basta

| Domínio | Propósito | Setado por |
|---|---|---|
| `app.ayoa.com` | Sessão na SPA do editor | `goto('https://app.ayoa.com/mindmaps/<uuid>')` |
| `auth.ayoa.com` | SSO token; mint-a a sessão `app.ayoa.com` | `goto('https://www.ayoa.com/')` → 302 |

O script `scripts/ayoa-login.js` da skill usa `gotoWithRetry('https://www.ayoa.com/')`
primeiro, e esse caminho passa pela redirect chain que seta o
`auth.ayoa.com`. Se o agente injetar cookies só de `app.ayoa.com` e
for direto em `https://app.ayoa.com/mindmaps/new`, a SPA redireciona
para `auth.ayoa.com/login` ("Sign in to AYOA") e o import nunca
começa.

**Sintoma:** URL final é `https://auth.ayoa.com/login?continue=...&clientId=<uuid>&source=web`.

**Fix:**
1. Re-export cookies pelo EditThisCookie com **todos os subdomínios**
   (`auth.ayoa.com` + `app.ayoa.com` + `www.ayoa.com` + `.ayoa.com`)
   — 14-16 cookies.
2. Ou: pedir ao user para fazer os 3 passos manualmente (caminho
   recomendado — < 30 s).

### 2. Canvas montado em Shadow DOM / custom elements

A Mind Map editor monta texto de nó dentro de um `<canvas>` (drag-and-drop
editor) + um DOM escondido com nós tipo `<g>` / `<text>` SVG-like que
**não expõem `contenteditable`**. `waitForSelector('[contenteditable="true"]')`
expira em 30 s mesmo com login OK.

```
FATAL TimeoutError: Waiting for selector `[contenteditable="true"], .mind-map-node, [data-testid="central-node"], text/Central` failed
```

**Fix:** Não inspecionar o canvas depois do upload. O ponto do import
é justamente que o canvas começa vazio no Passo 3 e fica populado
pela Ayoa após o upload. Só observar a URL mudar para
`https://app.ayoa.com/mindmaps/<new-uuid>` — esse é o sinal de
sucesso. A renderização interna é responsabilidade da Ayoa.

### 3. Banner HubSpot bloqueia o primeiro paint

Ver "Passo 0" acima. HubSpot injeta modal ~3 s após `domcontentloaded`,
e o `Accept` usa classe `hs-...` (não é classe da Ayoa). Scripts que
`goto` + imediatamente `waitForSelector('button:has-text("Novo projeto")')`
correm contra o banner e expiram.

## O que o script headless faz (e o que NÃO faz)

`scripts/import-opml-v3.js` (na skill) implementa o flow canônico com
os melhores seletores conhecidos em 2026-07-15. Captura screenshots
de diagnóstico em cada passo:

```
~/.ayoa-import-opml-v3-1-modal.png       # após Passo 1
~/.ayoa-import-opml-v3-2-after-create.png # após Passo 2
~/.ayoa-import-opml-v3-3-uploaded.png    # após upload (Passo 3)
~/.ayoa-import-opml-v3.png               # estado final (geralmente login)
```

**Ele NÃO completa o import** por causa da causa #1 (split de
cookies) — a URL final costuma ser `auth.ayoa.com/login`. Mantenha
como **sonda diagnóstica**, não ferramenta de produção.

**Diagnóstico pelo screenshot final:**
- Tela de login Ayoa ("Sign in to AYOA") → cookie JSON está faltando
  cookies de `auth.ayoa.com`. Re-export e re-paste.
- Editor de mapa novo (canvas vazio) → Passos 1 e 2 funcionaram;
  Passo 3 (file upload) é o problema — verificar construção do
  objeto `File` no `page.evaluate` que monta o `DataTransfer`.

## Caminho recomendado pelo agente (decisão de fluxo)

```
Tenho um .opml → gerar mapa no Ayoa
            │
            ▼
   Arquivo em ~/tmp/<slug>.opml?  ── NÃO ──► usar skill google-drive
            │                                  para gerar do Google Doc
            │ SIM
            ▼
   Plano Free ou Ultimate?     ── FREE ──►  avisar user: 20MB / 50k chars
            │ ULTIMATE
            ▼
   Pedir user para fazer os 3 passos manuais no browser dele.
   Entregar o path ~/tmp/<slug>.opml por clipboard ou mensagem.
   Aguardar user confirmar import OK (URL do mapa novo).
            │
            ▼
   Capturar a URL https://app.ayoa.com/mindmaps/<uuid>.
   Prosseguir com o pipeline (presenter, captura, vídeo, etc.)
```

## Skills irmãs e onde cada uma entra

- **`google-drive`** — gera o `.opml` a partir de um Google Doc.
  Output: `~/tmp/<doc-slug>.opml`. Aciona **antes** do flow de import.
- **`sensitive-credential-handling`** — dump seguro de cookies
  EditThisCookie → arquivo `~/tmp/ayoa-cookies.json` chmod 600 →
  shred após uso. Aciona **antes** de qualquer script Ayoa.
- **`browser-automation-arm`** — setup Puppeteer + Chromium no
  Termux. Aciona ao rodar `scripts/import-opml-v3.js` como sonda.
- **`clipboard-helper`** — leitura de cookies do clipboard. Aciona
  quando user cola cookies e quer converter para arquivo.

## Quando NÃO usar este flow

- O user pediu para **editar um mapa existente** (não criar) →
  carregar `ayoa-presenter.js` ou `ayoa-navigate.js`, não este flow.
- O `.opml` excede o limite do plano (Free: 20 MB / 50k chars;
  Ultimate: 60 MB / 50k chars) → pedir ao user para **reduzir o
  arquivo** ou fazer upgrade antes de tentar.
- O user já tem o mapa criado e quer só **atualizar o conteúdo** →
  o flow de import do Ayoa não suporta update-in-place; é
  **criar mapa novo** toda vez.

## Validação pós-import (sinal de sucesso)

Após o user confirmar que fez os 3 passos:

1. A URL é `https://app.ayoa.com/mindmaps/<uuid>` (regex:
   `^https://app\.ayoa\.com/mindmaps/[0-9a-f-]{36}$`).
2. O canvas mostra a árvore importada (nó central com o nome do
   Passo 2 + filhos do OPML).
3. O `mindmapId` extraído da URL é válido para scripts subsequentes
   (`ayoa-presenter.js`, `ayoa-capture-slides.js`, etc.).

## Histórico de versões desta referência

- **2026-07-15 (v1, atual):** consolida flow manual de 3 passos com
  labels pt-BR/en-US, três causas-raiz de falha headless (cookie
  split, canvas Shadow DOM, banner HubSpot), e o pipeline de decisão
  `gerar arquivo → 3 passos manuais → capturar URL`. Complementa
  `references/ayoa-import-opml.md` (v1.11.0) que cobre o flow
  operacional, e `references/ayoa-import-formats.md` que cobre o
  catálogo de formatos oficiais.
