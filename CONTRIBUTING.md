# Contributing

Obrigado por contribuir com a `ayoa-mindmap` skill. Este projeto é distribuído sob MIT e aceita PRs.

## Workflow

1. Fork o repositório e crie uma branch a partir de `main`:
   ```bash
   git checkout -b feature/minha-mudanca
   ```
2. Faça mudanças pequenas e focadas.
3. Rode a suíte completa localmente:
   ```bash
   cd scripts
   npm test
   ```
4. Confirme que o `ayoa-test-suite.js --test test-present-mode` passa.
5. Atualize `references/ayoa-learned-cases.md` ou `references/pitfalls.md` se aplicável.
6. Abra PR usando o template `.github/PULL_REQUEST_TEMPLATE.md`.
7. Aguarde a CI `lint-and-test` passar e a revisão do CODEOWNERS.

## Padrões de código

- **Seletores DOM do Ayoa** nunca são hard-coded fora de `scripts/`. Use fallbacks progressivos (classe → ARIA → texto → tooltip) e registre qualquer divergência em `references/ayoa-interface-equivalences.md`.
- **Testes determinísticos** são obrigatórios para cada novo contrato da skill. Use `scripts/ayoa-present-fixtures.js` para o DOM.
- **Sem credenciais no código** — `~/.tmp/*.cookies.json` é efêmero e está no `.gitignore`.

## Adicionar um caso de regressão

```js
// scripts/ayoa-present-<categoria>.test.js
const { withBrowser, installPanel, requireAyoaPresenter } = require('./ayoa-present-fixtures.js');

test('categoria: descrição do caso', async () => {
  // ...
});
```

## Reportar bug

Use `.github/ISSUE_TEMPLATE/bug_report.md` e inclua:

- Comando exato e stack trace
- Versão da Ayoa (`8.170.88` ou similar)
- Logs de `references/ayoa-learned-cases.md` se aplicável
- Mídia (screenshot ou JSON de `runFullPresentation`)

## Licença

Ao contribuir, você concorda que suas contribuições serão licenciadas sob MIT.
