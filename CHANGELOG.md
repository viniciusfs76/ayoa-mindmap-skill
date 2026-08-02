# Changelog

## v1.16.30 — 2026-08-02
- Primeiro push desde v1.16.3 (2026-07-16). Sync do estado local pós-v1.16.29.
- `ayoa-login.js`: CHROME_PATH configurável via env `AYOA_CHROME` (default headless_shell; `AYOA_CHROME=$PREFIX/lib/chromium/chrome` quando o mapa não carregar — fingerprint).
- `ayoa-presenter.js`: pre-flight de cookies (exit 2 se EXPIRED) + timeout 120s com polling 2s para mapas grandes (200+ nós).
- Guardrail: npm test 249/249 + pytest 22/22 (`cd scripts/tests && python3 -m pytest`).
- Bundle global ayoa v1.0.0 (hub + 8 módulos) criado em 2026-07-31.


Todas as mudanças notáveis da skill são registradas no campo `changelog` do `SKILL.md`. Este arquivo existe para navegação rápida.

## v1.6.0 — 2026-07-14
- 178 testes determinísticos em 16 suites (anti-regression, fallback, transitions, source-rotation, edge-cases, i18n EN/PT/ES, states, recovery, flicker, presentation-id, aria, driver).
- Helper compartilhado `ayoa-present-fixtures.js`.
- i18n: espanhol (`Crear automáticamente`, `Borrar todo`).
- `runFullPresentation`: `lastVisited` em deck de 1 item.

## v1.5.0 — 2026-07-14
- Cruzamento com pesquisa oficial: `support.ayoa.com`, `sitemap.xml`, `release notes`, `features/` (WP-JSON).
- Sinais visuais documentados (botão Present azul, blue squares).
- `+Add`/`Add all` → `Auto-create`; `Live share` (2024) vs `Dual Screen` (atual).

## v1.4.0 — 2026-07-14
- Driver `runFullPresentation` com máquina de estados explícita.
- CLI `--mode run [--expected-count N]`.

## v1.3.0 — 2026-07-14
- Política adaptativa: textos/posições/seletores não são invariáveis.

## v1.2.0 — 2026-07-14
- Present mode real: preparação idempotente, Auto-create, start/stop, navegação, compact/fullscreen.

## v1.1.0 — 2026-07-14
- Fontes oficiais do Present mode — domínio `support.ayoa.com`.

## v1.0.0 — 2026-07-14
- Release inicial.
