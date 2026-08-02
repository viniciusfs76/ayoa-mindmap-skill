# Ayoa `/v2/import/text` — bug: always generates Buzan template

**Descoberto em:** 2026-07-16, sessão de import do Maço WAIC (docx → OPML → import)

**Impacto:** o endpoint de import da Ayoa v2 ignora o conteúdo do arquivo OPML e sempre gera um template Buzan (OBJETIVO, CONTEXTO, IDEIAS, RECURSOS, PRÓXIMOS, RISCOS, RESULTADOS, APRENDIZADOS).

## Evidência

- 5 importações consecutivas com OPMLs diferentes (v1 = 102 nós, v2 = 28 nós, v3 = formato Ayoa com `_color`/`_icon` e `<title>Maço WAIC 2026</title>`)
- Todas as 5 retornaram o mesmo template Buzan de 34 nós no `verify.textNodes`
- Caminhos testados:
  - API path (`/v2/uploads` → S3 PUT → `/v2/import/text` → poll `import-jobs`): retorna 204 mas conteúdo é Buzan
  - UI path (`import-opml-v3.js` via `mindmaps/new` → criar projeto → importar): cria projeto mas deixa sem nós (0 slides, Presenter falha com timeout 40s)
  - BoardName explicitamente diferente de 'WAICO-MACO' (usei `--name WAIC-2026`): mesmo resultado
  - OPML com `_color`/`_icon` no formato Ayoa (cópia exata do fixture `waico-maco.opml`): mesmo resultado

## Causa raiz (hipótese)

O parser de OPML da Ayoa no backend reconhece a estrutura `<outline text="...">` mas **não** popula o mindmap com os nós fornecidos. O servidor cria um template Buzan padrão em vez de processar o conteúdo do arquivo. Endpoint `/v2/import/text` existe e aceita o upload, mas o parser é seletivo (talvez só funcione para formatos específicos como IMX/iMindMap).

## Workarounds disponíveis

### 1. Usar o Buzan WAICO-MACO existente (já funciona com Presenter)

O template Buzan é funcional para apresentações:
- 34 slides com estrutura lógica (Objetivo → Contexto → Ideias → Recursos → Riscos → Aprendizados)
- Suporta Presenter mode (`ayoa-presenter.js --mode prepare` + `capture-slides` + `video`)
- Tema `organic_v2` pode ser aplicado via `ayoa-apply-theme.js`
- Pipeline completo de captura funciona: `capture-slides` → `video` → `mv` + `termux-open`

### 2. Usar Puppeteer para criar nós manualmente (não testado)

Cada nó é adicionado via click + keyboard.type no canvas do Ayoa. Implementação futura:
```js
await page.click('.add-branch-button');
await page.keyboard.type('TEXTO DO NÓ');
await page.keyboard.press('Enter');
```
Tempo estimado: ~30s por nó (34 nós ≈ 17 min).

### 3. Fallback manual (3 cliques do user)

Documentado em `references/ayoa-import-opml.md` — user gera OPML, abre Ayoa manualmente, faz 3 cliques (Novo projeto → Mind Map → Importar). ~30s garantidos.

## Como detectar o bug

Após import bem-sucedido (exit 0, `boardId` e `mindmapId` retornados), verifique:
```bash
node scripts/ayoa-presenter.js --mode list \
  --target https://app.ayoa.com/mindmaps/<id> \
  --cookies ~/.cookiesAyoa-domain.json
# Se retornar slides com títulos Buzan (OBJETIVO, CONTEXTO, IDEIAS...),
# o bug está ativo — o conteúdo do seu OPML foi ignorado.
```

Se `ayoa-presenter.js --mode prepare` falhar com timeout 40s, o mapa está vazio (0 nós) — sinal de que a import via UI path também falhou em popular o canvas.

## Status

**Bug confirmado.** Nenhum workaround programático conhecido que force o Ayoa a aceitar o conteúdo do OPML. O `/v2/import/text` parece ser um endpoint de "criar template" com nome personalizado, não de "importar conteúdo real".

Próximo passo possível: sniffar a request que o browser faz quando o usuário arrasta um .opml para o canvas do Ayoa (WebSocket? Chrome DevTools Protocol?) e replicá-la.
