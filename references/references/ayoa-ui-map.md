# Mapa DOM do Ayoa (verificado em 2026-07-14)

## Layout geral

```
┌──────────────────────────────────────────────────────────────┐
│  Header (azul escuro) — y=0..45                             │
│  [Logo] [Menu] ... [Brasil Mais Digital] ... [Home][Notif]  │
├──────────────────────────────────────────────────────────────┤
│  Toolbar secundária — y=55..90                              │
│  Esquerda: [BancoIdeias][Undo][Redo][Link][Add][Select][Wand]│
│  Direita:   [AI][Share][Present][Export][Outline][Notes]...  │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  Canvas do mindmap (SVG) — área central                      │
│                                                              │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Cookie banner (quando ativo) — bottom overlay               │
│  [Accept] [Decline]                                          │
└──────────────────────────────────────────────────────────────┘
```

## Elementos críticos

### Toolbar — Apresentação
- Classe: `toggle-presenter`
- Posição: x=994, y=59 (1440x900 viewport)
- Estado ativo: classe `.toggle-presenter.selected`
- HTML: `<div class="btn btn-default toggle-presenter ">`

### Painel Apresentador (sidebar direita)
- Container: `.slides-list-container`
- Título: `.slides-list-title` — text="Apresentador"
- Lista de slides: `<ol>` dentro de `.slides-list-content`
- Item de slide: `<li class="slides-list-group-item">`
  - ID: UUID único (ex: `9f9c715d-3a0a-4765-b942-a0a2dc8a4bfe`)
  - Número: `.slides-list-group-counter`
  - Título: `.slides-list-group-content`
  - Item selecionado: classe `.selected`
- Botão play: `.slides-play-stop-button`
  - Posição: x=1141, y=352

### Botão play/stop e navegação
- Start/Stop: `.slides-play-stop-button`
  - parado: sem `.selected`
  - ativo: `.slides-play-stop-button.selected` e painel `.slides-list-container.presenting`
- Setas: primeiro e último filho de `.slides-nav-container`
- Tela dupla (Beta): `.slides-popout-button`
- Compacto: `.slides-compact-button` → painel `.slides-list-container.compact`
- Fullscreen: `.slides-fullscreen-button` → `#app-content.presenter-fullscreen`
- Em compact mode, a lista `<ol>` é desmontada; usar cache do deck/slide ativo.

### Botão Share
- Classe: `.react-share-options-trigger`
- Posição: x=939, y=59

### Botão Export
- Classe: `.export-button`
- Posição: x=1049, y=59

### Botão AI
- Classe: `.ai-button`
- Posição: x=886, y=59

### Cookie Banner
- Botão Accept: `button[aria-label="Accept"]`

### Header
- Título do mindmap: dentro de `entity-picker-dropdown-toggle`
- Botão "Novo projeto": `button:has-text("Novo projeto")`
- Botão "Menu": `button[title="Menu"]`

## Canvas do mindmap (modo edição)

- Renderizado como SVG
- O nó central está em x≈500-700, y≈340-450 (viewport 1440x900)
- Zoom controls no canto inferior direito
- Nós pai-filho conectados por paths SVG
- Texto dos nós dentro de elementos `<span>` aninhados em `<div>` e `<p>`

## Painel Apresentador — estrutura DOM detalhada

```
div.slides-list-container
  div.slides-list-title          "Apresentador"
  div.slides-header-controls     "Adicionar" (botão)
  div.slides-list-content
    ol
      li.slides-list-group-item[selected ou não]
        div.slides-list-group-counter  (número do slide)
        div.slides-list-group-content  (título do slide)
        div.slides-list-group-options  (botão X)
        ul (sub-itens aninhados)
          li.slides-list-item
            span (texto)
```

## Modais (criação de mindmap)

- Modal step 1: "Digite o nome do seu projeto"
- Modal step 2: "Escolha uma imagem central"
- Botão "Criar" no step 2
- Botão "Próximo" entre steps
