# Ayoa Mindmap Skill

Skill de automação determinística para **app.ayoa.com** via Puppeteer no Termux/Android. Cobre autenticação, navegação, Present mode (preparação, start/stop, navegação sequencial), captura de slides, geração de vídeo e ciclo adaptativo de aprendizado.

## Versão atual

`v1.6.0` — ver `SKILL.md` para o changelog completo.

## Requisitos

- Termux (Android aarch64) ou Linux/macOS com Chromium headless instalado.
- Node.js 22+ (recomendado 24+).
- Conta Ayoa Ultimate com cookies de sessão (capturar via `nlm-cookies-helper.sh` ou pelo DevTools do navegador).

## Instalação rápida

```bash
git clone https://github.com/<owner>/ayoa-mindmap-skill.git
cd aioa-mindmap-skill/scripts
npm install
npm test
```

## Uso

```bash
# Login por cookies e preparação do deck
node scripts/ayoa-presenter.js --cookies ~/tmp/ayoa-cookies.json \
  --target https://app.ayoa.com/mindmaps/<uuid> --mode prepare

# Driver canônico com máquina de estados
node scripts/ayoa-presenter.js --cookies ~/tmp/ayoa-cookies.json \
  --target https://app.ayoa.com/mindmaps/<uuid> --mode run \
  --expected-count 370 --screenshot ~/ayoa-run.png

# Captura + vídeo
node scripts/ayoa-capture-slides.js --cookies ~/tmp/ayoa-cookies.json \
  --target https://app.ayoa.com/mindmaps/<uuid> --output ~/slides
node scripts/ayoa-video.js --input ~/slides --output ~/apresentacao.mp4
```

## Testes

```bash
# Suite agregada (16 suites, 178 cenários determinísticos)
npm test

# Suite por categoria
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

# Driver de alto nível
node scripts/ayoa-test-suite.js --test test-present-mode
```

## Estrutura

```
ayoa-mindmap-skill/
├── SKILL.md                            # Descrição da skill + changelog
├── README.md                           # Este arquivo
├── LICENSE                             # MIT
├── CONTRIBUTING.md                     # Guia de contribuição
├── CODE_OF_CONDUCT.md                  # Código de conduta
├── SECURITY.md                         # Política de segurança
├── .github/
│   ├── workflows/
│   │   ├── lint-and-test.yml           # node --test em PRs e pushes
│   │   ├── release.yml                 # corte de tag + release notes
│   │   └── codeql.yml                  # análise de segurança
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug_report.md
│   │   └── feature_request.md
│   ├── CODEOWNERS                      # reviewers
│   ├── dependabot.yml                  # updates automáticos
│   └── PULL_REQUEST_TEMPLATE.md
├── references/                         # docs oficiais + aprendizados
└── scripts/                            # implementação Puppeteer + 178 testes
    ├── aioa-presenter.js               # driver canônico
    ├── aioa-login.js / aioa-test-suite.js / ...
    ├── aioa-present-fixtures.js        # helper compartilhado
    └── aioa-present-*.test.js          # 13 suites de regressão
```

## Segurança

- **Não** commitar cookies de sessão. Use `~/tmp/` e adicione `*.cookies.json` ao `.gitignore`.
- Captura de credenciais via clipboard do Termux (skill `sensitive-credential-handling`).
- Shredd após uso: `shred -u ~/tmp/<svc>-token.txt`.

## Fontes oficiais consultadas

- <https://support.ayoa.com/mind-mapping-tips-and-tricks> (canônica viva)
- <https://support.ayoa.com/mind-maps> (índice Mind Maps)
- <https://web.archive.org/web/2024/https://support.ayoa.com/present-your-mind-maps> (Wayback 2024, 17 passos + Live share)
- <https://web.archive.org/web/2025/https://support.ayoa.com/present-your-mind-maps> (Wayback 2025, "Presenting Mode" 14 passos)
- <https://support.ayoa.com/sitemap.xml> (262 URLs)
- <https://opengenius-marketing.s3.us-east-1.amazonaws.com/announcements/prod/changelog.json> (45 entradas 2025-02 → 2026-06)
- <https://www.ayoa.com/features/> (via WP-JSON `/wp-json/wp/v2/pages/2705`)

## Licença

MIT — ver `LICENSE`.
