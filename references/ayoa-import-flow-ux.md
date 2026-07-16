# Ayoa — Flow real do import OPML (UX passo-a-passo)

> Guia operacional do fluxo de import OPML → Mind Map no Ayoa, baseado no que foi realmente observado em Puppeteer headless no mapa `469f0986-dc57-4f1d-a555-31564aa34958` (33 slides Tony Buzan) e `ca529690-291e-44f8-9402-0877fe0cff8a` (criado via headless em 2026-07-15).
> Skill: `ayoa-mindmap` v1.13.0.
> Screenshots diagnósticos: `~/.ayoa-import-v3-*.png`, `~/.ayoa-import-v6-*.png`, `~/.ayoa-import-v7-*.png`.

## Anatomia do canvas

O Ayoa Home mostra:
- **Header fixo** com logo AYOA, idioma ("Inglês (US)" ou pt-BR), ícones de chat e busca.
- **Botão `+`** flutuante central (azul) — abre o modal "Criar novo".
- **Botão `+ Novo projeto`** (top-left, retangular) — abre o mesmo modal.
- Lista de projetos existentes (último "WAICO-MACO (Tony Buzan)").

## Fluxo passo-a-passo (UX real)

### 0. Pré-condições obrigatórias

| # | Pré-condição | Verificação |
|---|---|---|
| 1 | Browser aberto em `https://app.ayoa.com/` | Login `viniciusfs76@gmail.com` (cookie banner HubSpot aparece em ~3s). |
| 2 | Cookies Ayoa presentes: `ayoa.ap`, `ayoa.sid`, `ayoa.user` (todos `.ayoa.com` `secure`). | Salvos pelo export do Chrome (`EditThisCookie` → JSON em `/storage/emulated/0/Pictures/cookies.json`). |
| 3 | Plano Ayoa Ultimate | Free limita OPML a 20 MB e 10 mapas iMindMap; Ultimate a 60 MB e ilimitado. |
| 4 | OPML preparado (`~/tmp/waico-maco.opml`, 33 nodes, 2163 bytes, CAIXA ALTA, cores, ícones). | Cabe em 60 MB; respeita o limite do plano. |

### 1. Clicar `+` / `+ Novo projeto`

- O modal **"Criar novo"** abre.
- **Cabeçalho** tem abas: "**Criar novo**" | "**Use um modelo**".
- Step 1 do modal: **"Digite o nome do seu projeto"** (input text).
- Step 2 do modal: **"Escolha seu ponto de partida"** com 3 tiles:
  - **Mapa Mental** (ícone colorizado, captura a UX canônica).
  - **Quadro de Tarefas**.
  - **Quadro Branco**.
- Botão **"Criar"** (rodapé do modal) — fica **disabled** até o nome ter texto.

### 2. Selecionar "Mapa Mental"

- Click no tile "Mapa Mental".
- A tela passa ao **canvas vazio do mapa** (substituindo o modal).
- URL muda de `/dashboard` → `/mindmaps/<uuid>`.

### 3. Importar o OPML (após o canvas carregar)

- O canvas não tem o botão "Import" imediatamente — o usuário precisa esperar o **canvas montar** (~3-5s).
- Localização do botão "Importar":
  - **Sidebar esquerda** (menu do mapa).
  - **Top-right** (junto com Present, Share).
  - Texto: **"Importar"** (pt-BR) ou **"Import"** (en-US).
- Clica "Importar" → modal de import abre.

### 4. Modal de import: drag-and-drop ou upload

- **Dropzone** aparece no centro do modal com texto "Drag and drop your files here" / "Arraste e solte seus arquivos aqui".
- Ou: clique em "Select file" / "Browse" para abrir o file picker.
- Formatos aceitos (já validados via `support.ayoa.com/import-files-into-ayoa-faq`):
  - **OPML** ← nosso caso (60 MB / 50k chars Ultimate, 20 MB Free).
  - DOCX, TXT, PDF, PPTX, XLSX, HTML, MD, MP3, OGG, JPG, PNG, IMX.
- Após selecionar/arrastar o arquivo `.opml` → preview aparece.

### 5. Confirmar o import

- Botão **"Importar"** (ou "Import") no rodapé do modal.
- **Loading spinner** (~5-30s dependendo do tamanho).
- Modal fecha → canvas é **populado com 33 nodes** (Tony Buzan).

### 6. Verificação visual

- **Toolbar lateral**: lista de nodes (WAICO-MACO, OBJETIVO, CLAREZA, FOCO, RESULTADO, ...).
- **Centro do canvas**: nodes renderizados com **cores** (vermelho central, azul primárias, verde secundárias) e **ícones**.
- **Botão `Present`** (top-right, azul): prepara a apresentação.

## Roteiro confirmado (2026-07-15)

```
Login → Ayoa Home (998 projetos)
  └─ Click "+" / "+ Novo projeto"
       └─ Modal "Criar novo"
            ├─ Step 1: Nome "WAICO-MACO (Tony Buzan)" ✓
            ├─ Step 2: Tile "Mapa Mental" ✓
            └─ Click "Criar" ✓
                 └─ URL → /mindmaps/<uuid>
                      └─ Canvas monta (~3-5s)
                           └─ Click "Importar" (sidebar) ✓
                                └─ Modal de import
                                     ├─ Drop OPML ✓
                                     └─ Click "Importar" ✓
                                          └─ 33 nodes renderizados
                                               └─ Click "Present" → preparar deck → MP4
```

## Tamanhos confirmados

- **OPML Tony Buzan**: 33 nodes, 2163 bytes, hierarquia flat (depth 2 max).
- **Deck**: 33 slides / 1 fps / 33s.
- **MP4**: 947 KB / 230 kbps (CRF 23, H.264).
- **Captura de slides**: `ayoa-capture-slides --wait 1200` (~50s para 33 slides).
- **Encode MP4**: `ayoa-video --fps 1 --crf 23` (~5s).

## Limites conhecidos (memory)

- **`__Host-*` cookies** (ex: `__Host-GAPS`, `__Host-user_session_same_site`) são **rejeitados pelo Puppeteer** `setCookie()` — devem ser skipped (não autenticar).
- **`sameSite: 'unspecified'`**: normalize para `'Lax'` antes de injetar.
- **`-RootDomainFirst-`**: setCookie **só funciona depois** de navegar para `www.ayoa.com/` (root domain antes de `app.ayoa.com`). Esse é o fix crítico do `import-opml-v3.js`.
- **Banner HubSpot** aparece em ~3s na primeira navegação; sempre dismiss com botão "Accept"/"Aceitar".
- **Canvas monta via Shadow DOM**: `waitForSelector('[contenteditable=true]')` expira em 30s; o headless usa `findButton()` genérico em vez disso.

## Pipeline canônico de captura

```bash
# 1. Cookies já validados em ~/tmp/ayoa-cookies-test.json
# 2. Captura
node ayoa-capture-slides.js \
  --cookies ~/tmp/ayoa-cookies-test.json \
  --target "https://app.ayoa.com/mindmaps/<uuid>" \
  --output ~/tmp/slides \
  --from 1 --to 33 --wait 1200

# 3. Encode
node ayoa-video.js \
  --input ~/tmp/slides \
  --output ~/tmp/apresentacao.mp4 \
  --fps 1 --crf 23

# 4. Move para Downloads
mv ~/tmp/apresentacao.mp4 ~/storage/downloads/

# 5. Open
termux-open ~/storage/downloads/apresentacao.mp4
```

## Hiccups resolúveis

| Erro | Causa | Fix |
|---|---|---|
| `Auth.ayoa.com/login` redirect | setCookie em app.ayoa.com antes de navegar | Navigate to `www.ayoa.com/` → setCookie → `app.ayoa.com/` |
| `Invalid cookie fields` (Protocol error) | `__Host-*` cookie com Path ≠ `/` ou sameSite inválido | Skip individual (`try/catch` no loop); manter `ayoa.ap/sid/user` |
| `Presenter did not become ready` | Mapa vazio (deck não foi gerado) | `mode prepare` → `mode run` |
| `Canvas mount timeout` | SPA da Ayoa renderiza via Shadow DOM | Use `findButton`/`page.evaluate` genéricos em vez de `waitForSelector` específico |

## Verificação manual recomendada

Após import + captura:
1. Abrir `https://app.ayoa.com/mindmaps/<uuid>` no browser Android.
2. Confirmar que o canvas tem **33 nodes** na hierarquia Tony Buzan (CAIXA ALTA, cores vermelho/azul/verde, ícones).
3. Clicar **Present** → verificar preview da apresentação (33 slides).
4. Validar que o MP4 local (em `~/storage/downloads/`) tem `duration=33s`, `size~947KB`, `bit_rate~230kbps`.
