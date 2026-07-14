# Fontes oficiais — Ayoa Mindmap Skill

Documentação canônica e histórica consultada para a skill `ayoa-mindmap`. Esta lista é versionada em `SKILL.md` e em `references/present-mode-official.md`; este arquivo é apenas um índice rápido.

## URLs vivas (verificadas em 2026-07-14)

| Recurso | URL | Estado |
|---|---|---|
| Help Centre — Mind Map extra features | <https://support.ayoa.com/mind-mapping-tips-and-tricks> | ✅ Viva; seção "Present your Mind Map" |
| Help Centre — índice Mind Maps | <https://support.ayoa.com/mind-maps> | ✅ Viva; índice canônico |
| Help Centre — sitemap | <https://support.ayoa.com/sitemap.xml> | ✅ 262 URLs; sem a página de Present mode |
| Marketing features | <https://www.ayoa.com/features/> (via WP-JSON `/wp-json/wp/v2/pages/2705`) | ✅ Viva |
| Blog oficial de lançamento | <https://www.ayoa.com/ourblog/sharing-your-ideas-is-now-easier-than-ever-with-mind-map-present/> | ✅ Viva; 13/10/2020 → 07/03/2023 |
| Release notes feed | <https://opengenius-marketing.s3.us-east-1.amazonaws.com/announcements/prod/changelog.json> | ✅ 45 entradas 2025-02 → 2026-06 |
| Help Center — Present your Mind Maps (canônica) | <https://support.ayoa.com/present-your-mind-maps> | ❌ 404 (removida em 2026) |
| Wayback Machine — 2024 | <https://web.archive.org/web/2024/https://support.ayoa.com/present-your-mind-maps> | ✅ 17 passos + Live share |
| Wayback Machine — 2025 | <https://web.archive.org/web/2025/https://support.ayoa.com/present-your-mind-maps> | ✅ "Presenting Mode" 14 passos |
| Help Center — Auto-Focus | <https://support.ayoa.com/how-to-use-auto-focus-in-mind-maps> | ✅ Viva; mecanismo adjacente |
| Help Center — collapse/auto-layout | <https://support.ayoa.com/collapsing-branches-and-auto-focus> | ✅ Viva; mecanismo adjacente |
| Help Center — keyboard shortcuts | <https://support.ayoa.com/how-to-access-keyboard-shortcuts-in-ayoa> | ✅ Viva |

## Domínio correto

`support.ayoa.com` (HubSpot KB). **`help.ayoa.com` não resolve DNS** — substituir sempre que aparecer.

## Plano e plataforma

- **Ayoa Ultimate** (gating explícito).
- **Mind Maps e Whiteboards** (suporte oficial).
- **Web/Desktop** (a documentação não confirma suporte mobile).

## Mapeamento histórico → atual

| Conceito | UI/documentação histórica | UI atual observada (8.170.88) |
|---|---|---|
| Abrir preparação | Present button abre a `present window` | `.toggle-presenter` abre painel `Presenter/Apresentador` |
| Adicionar um ramo | Bookmarks / selecionar ramo + Add | Selecionar elemento + `Add/Adicionar` |
| Adicionar todos | `Add all` | `Auto-create` |
| Limpar deck | `Clear all` | Menu `…` → `Clear all` |
| Reordenar | Drag-and-drop | `<li draggable="true">` em `.slides-list-content` |
| Iniciar | `Start presenting` | `.slides-play-stop-button` + `.presenting` |
| Fullscreen | Direto | `.slides-fullscreen-button` → `#app-content.presenter-fullscreen` |
| Dual screen | `Live share` (2024) | `.slides-popout-button` (Dual Screen Beta) |
