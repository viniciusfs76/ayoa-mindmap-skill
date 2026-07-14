# CI

A skill roda CI em GitHub Actions. Toda `push` e todo `pull_request` em `main` acionam:

- **`lint-and-test.yml`** — executa `node --check` em todos os scripts e roda `npm test` (16 suites, 178 cenários determinísticos) em Node.js 22 e 24 no Ubuntu.
- **`codeql.yml`** — análise estática semanal de segurança/qualidade em JavaScript.

`release.yml` corta a tag (`v*`) e cria um GitHub Release com a seção do `CHANGELOG.md` correspondente.

## Como verificar localmente

```bash
cd scripts
npm install
npm test
```

## Como rodar uma única suite

```bash
npm run test:present-mode
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
```

## Cobertura de testes

A skill mede cobertura de **comportamento** (cenários determinísticos) e não linhas executadas. Os 178 cenários cobrem:

- Classificação e ciclo de vida da apresentação.
- i18n EN/PT/ES para todos os rótulos.
- Detecção e localização do botão Present.
- Estados da máquina `runFullPresentation`.
- Resiliência a un-mount, re-render e double-click.
- ARIA contract e selectores alternativos.
- Contrato programático do driver.

Total agregado: 178/178 verde em ~25s em Termux/Android.
