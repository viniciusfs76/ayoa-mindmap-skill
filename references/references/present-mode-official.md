# Present mode (Ayoa) — Documentação oficial consolidada

**Verificado em:** 2026-07-14
**Skill relacionada:** `ayoa-mindmap`
**Carregue esta referência** antes de auditar, testar ou modificar qualquer fluxo de apresentação.

---

## 1. TL;DR

- **Nome oficial:** Present mode (também grafado "Presenting Mode" na documentação de 2025).
- **Onde está no app:** Mind Map View (top-right, botão **Present**) e Whiteboards.
- **Plano:** **Ayoa Ultimate** exclusivo (free não vê o botão).
- **Status da página canônica:** a URL oficial `https://support.ayoa.com/present-your-mind-maps` foi **removida em 2026** (retorna HTTP 404). O conteúdo está preservado no **Wayback Machine** — versões 2024 e 2025 diferem em nomenclatura.
- **Cross-reference viva:** a página ativa `https://support.ayoa.com/mind-mapping-tips-and-tricks` descreve Present mode em uma seção própria e cita o link para `present-your-mind-maps` (que está 404).
- **Release notes:** o JSON público em `https://opengenius-marketing.s3.us-east-1.amazonaws.com/announcements/prod/changelog.json` (45 entradas de 2025-02 → 2026-06) **não tem nenhuma entrada dedicada a Present mode**. Útil para checar mudanças futuras sem precisar baixar páginas.

## 2. Fontes oficiais verificáveis

| Tipo | URL | Estado em 2026-07 |
|---|---|---|
| Help Centre — índice Mind Maps | `https://support.ayoa.com/mind-maps` | ✅ Viva; índice canônico atual, referencia `mind-mapping-tips-and-tricks`, mas não possui artigo autônomo de Present mode |
| Blog oficial de lançamento (2020; atualizado 2023) | `https://www.ayoa.com/ourblog/sharing-your-ideas-is-now-easier-than-ever-with-mind-map-present/` | ✅ Viva; baseline da UI anterior: bookmarks, Add all, drag/drop, Clear all, Start/Stop e fullscreen |
| Help Center (canônica antiga) | `https://support.ayoa.com/present-your-mind-maps` | **404** (removida) |
| Help Center (cross-ref ativa) | `https://support.ayoa.com/mind-mapping-tips-and-tricks` | ✅ Viva; contém seção "Present your Mind Map" |
| Wayback Machine (v2024) | `https://web.archive.org/web/2024/https://support.ayoa.com/present-your-mind-maps` | ✅ Preservada — 17 passos + live share |
| Wayback Machine (v2025) | `https://web.archive.org/web/2025/https://support.ayoa.com/present-your-mind-maps` | ✅ Preservada — "Presenting Mode" com 14 passos |
| Marketing features page | `https://www.ayoa.com/features/` (via `/wp-json/wp/v2/pages/2705`) | ✅ Viva; menciona "Mind map present will enable you to grab their attention by revealing the branches of your map one-by-one" |
| Help Center sitemap | `https://support.ayoa.com/sitemap.xml` | ✅ 262 URLs; **NÃO contém a página de Present mode** (confirma remoção) |
| Release notes feed | `https://opengenius-marketing.s3.us-east-1.amazonaws.com/announcements/prod/changelog.json` | ✅ 45 entradas (2025-02 → 2026-06); nenhuma para Present mode |

**Domínio correto:** `support.ayoa.com` (HubSpot KB). **`help.ayoa.com` não resolve DNS** — substituir por `support.ayoa.com` sempre que aparecer.

## 3. Citação oficial (fonte: `mind-mapping-tips-and-tricks`, ativa em 2026-07-14)

> "Present your Mind Map — Re-invigorate your team meetings by presenting a Mind Map! In present mode you can communicate your ideas in bite-sized chunks and in a colourful, dynamic and visually appealing way. Methodically navigate around the project, demonstrating the thought process and development of each idea. You can select the elements you wish to include in your presentation, and AYOA will progress through your selection intuitively. Encourage team discussion and development of the project in directions you may not have considered! **Present mode is exclusive to Ayoa Ultimate and is available on Mind Maps and Whiteboards.**"

## Citação oficial de marketing (fonte: `https://www.ayoa.com/features/`, via WP-JSON `/wp-json/wp/v2/pages/2705`)

> "Mind map present will enable you to grab their attention by revealing the branches of your map one-by-one."

## Sinais visuais documentados

- **Botão Present destacado em azul** = modo ativo (Wayback 2024, passo 3).
- **Blue squares of the boundary** ao redor do item selecionado = ajuste de zoom por slide
  (Wayback 2024, passo 9).
- Em headless, a UI real do Ayoa Web 8.170.88 **não aplica a cor azul do botão** da forma
  observada historicamente; validar pelo estado `.presenting` no painel e por
  `.toggle-presenter.selected` quando aplicável.

## Termos e aliases (usar como fallback, não como invariante)

- `Present mode`, `Presenting Mode` (2025), `Present tool`, `Present button`, `Presenter slides` (2024).
- `+Add` (UI histórica), `Add all` (UI histórica) e `Auto-create` (UI atual) são o mesmo
  conceito de "incluir todos os ramos" — a interface atual é `Auto-create`.
- `Clear all` é estável entre versões; só muda o caminho de acesso
  (menu `…` no Ayoa 8.170.88).
- `Start presenting` e `Stop presenting` são estáveis na documentação; na UI atual são
  partes do mesmo botão `.slides-play-stop-button`.
- **Dual Screen** (UI atual) ≠ **Live share** (UI 2024) — tratá-los como recursos
  distintos; o atual usa `.slides-popout-button` e o antigo era restrito a membros
  do board.

## Mecanismos adjacentes de "revelar" conteúdo (não substituem Present mode)

- **Auto-Focus** (Settings → Display Options → slider `Auto Focus`, estados `OFF / ON / ON+`).
- **Collapsing branches** (ícone de duas setas convergentes; atalho `Ctrl/Cmd + ←/→`).
- Úteis para navegação manual, mas a skill deve tratá-los como caminhos diferentes do
  Present mode, com seletores próprios (a interface atual não os mantém quando o
  Present está ativo).

## 4. Fluxo oficial completo — versão Wayback Machine 2024 (17 passos)

> Esta é a versão mais detalhada preservada; cite-a em testes quando precisar validar comportamento passo-a-passo.

1. To create your presentation, first open the mind map.
2. In the top right-hand side, click on the **Present** button; this opens the **present window** used to prepare the presentation.
3. This will activate the present mode. If the present button is highlighted **blue**, this means you are in present mode.
4. To add individual branches, click on the branch to select it, then in the Present menu click **+Add**.
5. To remove a branch from the list, click on the **X** next to the branch name.
6. To change the order of the branches, simply **grab the branch and move it** to the chosen position (drag-and-drop na lista).
7. If you want to add all of the branches from your mind map, click **Auto-create**.
8. To clear all the Present branches that you have added, click **Clear all**.
9. To adjust how zoomed in or out a slide is, you can use the **blue squares of the boundary** around the selected item.
10. Once you are ready, click **Start presenting**.
11. This will open up additional presentation options.
12. You can reduce and maximise the size of the menu by clicking on **collapse button**. This helps to focus on the presenter slides.
13. To make the presentation full screen and hide the other menus, click the **full screen button**.
14. The main toolbar will be hidden. To exit full screen mode, click on the full screen button again.
15. The **live share button** will allow team members added to the board to focus on the different elements being displayed in the presentation from their own Ayoa account.
16. To navigate through the different slides, use the directional keys in the menu, or keys on your keyboard: **arrows / space bar**.
17. To end the presentation, click **Stop presenting**. Your slides will be saved and you can re-start your presentation at any time.

## 5. Versão Wayback Machine 2025 ("Presenting Mode") — diferenças notáveis

- Mesma essência, mas com nova grafia "Presenting Mode" como categoria no menu lateral.
- Reorganizado em passos numerados diferentes (1–17, mas pulos no 11 e 15).
- Removida referência explícita ao "live share button" como passo distinto.
- Substituiu "in the menu" por "in the Present menu" em vários pontos.

**Implicação para testes:** scripts baseados só no número do passo são frágeis; prefira asserções sobre **strings de UI** e **estados** (e.g. `button[aria-label="Present"]`, classe `active`/`highlighted`, presença de `.slides-list`).

## 6. Requisitos e limitações

| Item | Valor oficial | Como verificar |
|---|---|---|
| Plano mínimo | Ayoa Ultimate | Tentar com conta free: botão Present ausente |
| Plataformas | Mind Map View, Whiteboards | Não disponível em Radial/Capture/Task boards |
| Mobile (iOS/Android) | **Não documentado** para Present mode (a página `mind-mapping-tips-and-tricks` trata Mind Maps e Mobile separadamente) | Teste empírico via Puppeteer em viewport mobile se alvo |
| Persistência | Slides salvos por sessão | Reabrir o mind map após reload deve manter a lista |
| Auto-Focus adjacente | Settings → Display Options → slider `Auto Focus` (OFF/ON/ON+) | Independente de Present mode; colapsa/expande manualmente |

## 7. Auto-Focus como alternativa "manual"

Documentação oficial confirma **dois mecanismos oficiais** para revelar branches progressivamente:

1. **Present mode** (formal): constrói lista explícita de branches, ajusta zoom por item, apresenta.
2. **Auto-Focus** (manual, ad-hoc): Settings → Display Options → toggle `Auto Focus`.
   - `OFF` → todos os branches visíveis.
   - `ON` → clica em um parent → mostra só um nível de children.
   - `ON+` → clica em um branch → mostra todos os descendentes.

**Atalho útil:** `Ctrl/Cmd + ←/→` colapsa/expande o branch selecionado (não é Present mode, mas compartilha o conceito de navegação granular).

## 8. Cookies / autenticação relevantes

Para chegar ao Present mode, o usuário precisa estar logado com plano **Ayoa Ultimate**. Cookies mínimos (ver `references/pitfalls.md`):

- `domain: ".ayoa.com"` (com ponto) — não funciona sem.
- Puppeteer exige `page.goto('https://www.ayoa.com/')` antes de `setCookie()`.

## 9. Seletores DOM prováveis (para scripts Puppeteer)

> Inferidos da documentação + prática. Confirmar via DevTools antes de cada release.

```js
// Botão Present (top-right do Mind Map view)
'[aria-label*="Present" i]'
'[data-testid*="present" i]'
'.toggle-presenter'         // histórico (já referenciado em pitfalls.md)

// Estado ativo do botão (highlighted blue)
'.toggle-presenter.active'  // histórico
'button[aria-pressed="true"][aria-label*="Present" i]'

// Menu Present (lateral com lista de slides)
'.present-menu'
'.slides-list'
'.presentation-panel'

// Ações do menu
'button:has-text("+Add")'         // Playwright text=
'button:has-text("Auto-create")'
'button:has-text("Clear all")'
'button:has-text("Start presenting")'
'button:has-text("Stop presenting")'
'button[aria-label*="collapse" i]'
'button[aria-label*="full screen" i]'
'button[aria-label*="live share" i]'

// Navegação entre slides
'.present-menu [aria-label*="next" i]'
'.present-menu [aria-label*="prev" i]'

// Boundary (zoom por item)
'.slides-list .selected [data-boundary-handle]'  // blue squares
```

**Pitfall de querySelector:** IDs de slide no Ayoa começam com hex/dígitos → preferir `getElementById` ou `text=` do Playwright (não `querySelector('#9f9c...')`).

## 10. O que checar antes de tocar em `scripts/ayoa-presenter.js`

1. **Plano do usuário:** logado como Ayoa Ultimate? Se não, botão não existe.
2. **Tipo de projeto:** Mind Map view (não Radial/Capture)?
3. **Carregamento:** aguardar 8-18s após `goto` antes de procurar o botão (SPA pesado).
4. **Cookie banner:** dispensar com `button[aria-label="Accept"]` (ver pitfalls.md).
5. **Modo Apresentação em headless:** fullscreen API não funciona (já documentado em pitfalls.md) → estratégia é clicar em cada item da lista lateral.
6. **Estado "highlighted blue":** se o botão não ficar azul após o click, o Present mode não ativou — provavelmente cookies/plano errados.

## 11. Histórico de mudanças desta referência

- 2026-07-14: criação inicial. Inclui Wayback Machine 2024 e 2025, citação oficial de `mind-mapping-tips-and-tricks`, fontes de release notes/sitemap, e inferências de seletores DOM para Puppeteer/Playwright.