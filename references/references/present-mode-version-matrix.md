# Matriz de diferenças do Ayoa Present mode

Use esta matriz para não misturar documentação histórica, documentação viva e seletores atuais.

| Conceito | UI/documentação histórica | UI atual observada (8.170.88) | Regra para automação |
|---|---|---|---|
| Abrir preparação | Present button abre a `present window` | `.toggle-presenter` abre painel `Presenter/Apresentador` (`.slides-list-container`) | Painel aberto ≠ apresentação ativa |
| Adicionar um ramo | Bookmarks / selecionar ramo + Add | Selecionar elemento + `Add/Adicionar` | Adicionar somente seleção explícita |
| Adicionar todos | `Add all` | `Auto-create` quando deck vazio | Mapear intenção `all` para Auto-create; validar contagem/ordem |
| Limpar deck | `Clear all` | Menu `…` → `Clear all` | Remove slides da apresentação; nunca apagar nós do mapa |
| Reordenar | Drag-and-drop na present window | `<li draggable="true">` em `.slides-list-content` | Validar ordem final por IDs/títulos |
| Iniciar | Start presenting; historicamente associado a fullscreen | `.slides-play-stop-button`; estado `.presenting` | Start e Fullscreen são estados separados |
| Fullscreen | Entrada direta/full-screen mode | `.slides-fullscreen-button` → `#app-content.presenter-fullscreen` | Não depender só de `document.fullscreenElement` |
| Compactar | Collapse/reduce menu | `.slides-compact-button`; painel `.compact` | Cachear deck: lista é desmontada do DOM |
| Navegar | Setas do menu/teclado | `.slides-nav-container`, setas/PageUp/PageDown/espaço | Confirmar slide ativo e esperar canvas assentar |
| Encerrar | Stop presenting | play/stop `.selected` → sem `.presenting` | Confirmar transição antes de concluir |
| Dual screen | Live share mencionado em versões antigas | `.slides-popout-button`, Dual Screen Beta | Tratar como recurso distinto, não como fullscreen |

## Fontes

- Blog oficial histórico: https://www.ayoa.com/ourblog/sharing-your-ideas-is-now-easier-than-ever-with-mind-map-present/
- Artigo oficial vivo: https://support.ayoa.com/mind-mapping-tips-and-tricks
- Índice oficial atual: https://support.ayoa.com/mind-maps
- Detalhes consolidados: `references/present-mode-official.md` e `references/ayoa-present-mode-official.md`
