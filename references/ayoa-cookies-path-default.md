# Pitfall — Default `COOKIES_FILE` aponta para path de teste, não para cookies do user (2026-07-19)

## Sintoma

`node import-opml.js --help` (ou qualquer script canônico da skill sem flag `--cookies`)
bate no preflight `validateCookies()` e reporta `EXPIRED` referenciando cookies `__Secure-*`
que **não estão** no `~/cookiesAyoa.json` do user. O `cookie-validator.js` mostra
`cookiesPath: /data/data/com.termux/files/home/tmp/ayoa-cookies-test.json` — arquivo
antigo de teste com cookies expirados.

O user acabou de colar cookies novos do Chrome via EditThisCookie no clipboard e está
convencido de que estão válidos. O `ayoa-cookies-check.js` (checker canônico) confirma
`VALID` quando apontado para `~/cookiesAyoa.json`. O problema **não é o cookie real**;
é o path default do script canônico.

## Causa raiz

Linha 46 dos scripts canônicos (`import-opml.js`, `ayoa-presenter.js`,
`ayoa-capture-slides.js`, `ayoa-apply-theme.js`, etc.):

```js
const COOKIES_FILE = ARGS.cookies || `${process.env.HOME}/tmp/ayoa-cookies-test.json`;
```

- `~/tmp/ayoa-cookies-test.json` é o path de testes da própria skill (criado em 2026-07-15
  durante desenvolvimento do `import-opml-v3.js`).
- **Não há auto-detecção** do path canônico (`~/cookiesAyoa.json`).
- A flag `--cookies` é obrigatória para qualquer uso em produção.

## Diagnóstico

```bash
# 1) Confirmar que o cookie real do user está OK
node ~/.hermes/skills/ayoa-login/scripts/ayoa-cookies-check.js --cookies ~/cookiesAyoa.json
# esperado: ✓ Cookie validation: VALID

# 2) Confirmar que o default do script aponta para path errado
grep -n "COOKIES_FILE" ~/.hermes/skills/software-development/ayoa-mindmap/scripts/import-opml.js | head -3
# esperado: linha 46 mostrando "ayoa-cookies-test.json" como fallback
```

## Fix canônico

**Sempre invocar scripts com `--cookies ~/cookiesAyoa.json` explícito**:

```bash
node import-opml.js --cookies ~/cookiesAyoa.json --opml ~/tmp/briefing.opml --name 'Briefing X'
node ayao-presenter.js --cookies ~/cookiesAyoa.json --target https://app.ayoa.com/mindmaps/<uuid> --mode prepare
node ayao-capture-slides.js --cookies ~/cookiesAyoa.json --target https://app.ayoa.com/mindmaps/<uuid>
node ayao-apply-theme.js --cookies ~/cookiesAyoa.json --target <uuid> --theme radial
```

## Pattern recomendado (workflow completo)

Quando o user disser "atualizei os cookies" / "cookies no clipboard":

1. Copiar do clipboard: `termux-clipboard-get > ~/tmp/clip-cookies.json`
2. Validar estrutura: `node -e "JSON.parse(require('fs').readFileSync('/path'))"` (sem truncar)
3. Gravar com permissão restrita: `cp ~/tmp/clip-cookies.json ~/cookiesAyoa.json && chmod 600 ~/cookiesAyoa.json`
4. **Wipe clipboard**: `printf '' | termux-clipboard-set`
5. Validar cookies: `node ~/.hermes/skills/ayoa-login/scripts/ayoa-cookies-check.js --cookies ~/cookiesAyoa.json --invalidate-cache`
6. **Sempre passar `--cookies ~/cookiesAyoa.json`** nos scripts canônicos (nunca usar default)

## Validação real

Caso 2026-07-19:
- User copiou cookies do Chrome → gravou em `~/cookiesAyoa.json` (9 cookies válidos, todos com expiração futura)
- `import-opml.js --help` falhou com `EXPIRED` referenciando `__Secure-*` cookies ausentes do dump novo
- `cookie-validator.js` confirmou `cookiesPath: ~/tmp/ayoa-cookies-test.json` (não `~/cookiesAyoa.json`)
- `import-opml.js --cookies ~/cookiesAyoa.json --opml ... --name ...` validou 9/9 injetados e prosseguiu
- Resultado: mapa `c6ea2f1c-f73a-4a0d-9126-c4d9f1aa37e4` criado em `https://app.ayoa.com/mindmaps/c6ea2f1c-f73a-4a0d-9126-c4d9f1aa37e4`

## Cross-reference

Ver também:
- `references/ayoa-cookie-json-validator-cookbook.md` — três classes de problema de cookies (JSON truncation, validator false-positive, JSON.stringify(regex))
- Skill `ayao-login` SKILL.md — Cenário 4 (cache staleness após re-export)
- Skill `sensitive-credential-handling` — fluxo seguro de cookies do clipboard para arquivo