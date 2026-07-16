---
name: azoa-v2-import-api
description: Contrato vivo da Ayoa v2 import API — endpoints, headers, fluxo assíncrono, causa raiz de error.code:INTERNAL_ERROR, e heurística de polling
when_to_load: Ao construir/diagnosticar import OPML/DOCX/TXT headless, ou quando o painel "1 import failed" aparece mas o import-jobs retorna 204
---

# Ayoa v2 Import API — contrato vivo

Verificado em 2026-07-16 durante o caso real da final da Copa 2026
(Argentina x Espanha, mapa d0b3c41e-...-46e9, 49 nós, 8 ramos).

## Endpoints

- POST /v2/uploads — pré-sinaliza URL no S3 (droptask-attachments-1.s3.amazonaws.com) e devolve POST policy
- POST /v2/import/text — submete o arquivo já no S3; retorna 204 quando aceita o job (processamento assíncrono)
- GET /v2/import-jobs?t=<ms> — lista os jobs do user; cada item tem status, error, result.paperIds
- GET /v2/images?id=<uuid>&entityType=PAPER&entityId=<uuid> — recursos das imagens usadas no canvas

## POST /v2/import/text — payload JSON obrigatório

```json
{
  "fileUrl": "https://droptask-attachments-1.s3.amazonaws.com/<key>/<file>",
  "fileName": "mapa.opml",
  "type": "TEXT_FILE",
  "boardName": "Título do Mapa",
  "themeId": "organic_v2",
  "boardId": "novo-uuid-..."
}
```

Resposta: 204 No Content quando o job foi enfileirado. NÃO é síncrono;
o mapa aparece no editor somente após o polling confirmar status:COMPLETED.

## Headers obrigatórios (Puppeteer + xhr)

- x-auth-token — UUID (mesmo do azoa.ap cookie)
- x-client-id — UUID v4 (crypto.randomUUID() por request)
- x-source — "web" (hardcoded)
- x-source-version — "8.170.89" (versão atual observada; muda a cada release)
- x-agent — User-Agent; em GET /v2/import-jobs rejeita HeadlessChrome/*
- x-request-id — UUID v4 (correlaciona com x-droptask-request-id da response)
- content-type — "application/json;charset=UTF-8"
- x-requested-with — "XMLHttpRequest"

Pitfall (2026-07-16): chamar GET /v2/import-jobs via page.evaluate(fetch(...))
sem propagar X-Agent e X-Client-Id retorna 400 Invalid X-Agent header,
mesmo com x-auth-token válido. Capture os headers da request POST e
re-injete-os no fetch subsequente.

## Fluxo assíncrono

1. POST /v2/uploads → 200 com { url: <S3 PUT URL>, form: <AWS policy> }
2. Browser (ou curl) faz PUT no S3 com o policy
3. POST /v2/import/text → 204 (job enfileirado)
4. loop GET /v2/import-jobs até item.status === "COMPLETED" + item.result.paperIds[0]
5. URL final: https://app.ayoa.com/mindmaps/<paperId[0]>

## Tabela de erros observados

| import/text | import-jobs | Causa | Fix |
|-------------|-------------|-------|-----|
| 204 | status:COMPLETED, error:{code:INTERNAL_ERROR} | boardName:"" no body; parser falha | Garantir título no input "Digite o nome do seu projeto" |
| 204 | error:{code:INVALID_FILE} | extensão não suportada (.xmind.opml) | usar .opml puro |
| 204 | error:{code:INTERNAL_ERROR} | payload > 50k chars (plano Free) | fatiamento por seção |
| 400 | Bad Request | headers faltando (X-Agent, X-Client-Id) | capturar da POST e propagar |

## Pitfall crítico: boardName:"" parece OK mas produz INTERNAL_ERROR

Sintoma: painel mostra "Importação Completa, 1 import failed" e o
import-jobs retorna status:COMPLETED,error:{code:INTERNAL_ERROR}. O
mapa não aparece no editor.

Causa raiz: o import-text recebe boardName:"" quando o script clica
no input errado. Ayoa tem DOIS inputs visíveis no estado inicial do
dashboard:
1. <input placeholder="Pesquisar projetos"> — searchbar global (ignorar)
2. <input placeholder="Digite o nome do seu projeto"> — o do modal de
   criação (usar este)

Heurística robusta: procurar pelo placeholder com regex
/digite o nome|digite um|nome do seu projeto|project name|board name/i
em vez de "primeiro input visível".

Fix de typing para React/Input controlado (essencial em 2026-07-16):

```js
inp.focus();
const proto = Object.getPrototypeOf(inp);
const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
setter.call(inp, title);
inp.dispatchEvent(new Event('input',  { bubbles: true }));
inp.dispatchEvent(new Event('change', { bubbles: true }));
inp.dispatchEvent(new Event('blur',   { bubbles: true }));
```

Validação de segurança no script: após capturar a request
POST /v2/import/text, parsear body, e se boardName !== <esperado>
abortar com mensagem clara — não confiar no 204.

## Polling heurístico

```js
let job = null;
for (let i = 0; i < 10; i++) {
  const r = await page.evaluate(async (h) => {
    const r = await fetch('/v2/import-jobs?t=' + Date.now(), {
      headers: { 'x-auth-token': h['x-auth-token'], 'x-client-id': h['x-client-id'],
                 'x-source': h['x-source'], 'x-source-version': h['x-source-version'],
                 'x-agent': h['x-agent'], 'x-request-id': crypto.randomUUID(),
                 'x-requested-with': 'XMLHttpRequest' },
      credentials: 'include',
    });
    return { s: r.status, t: await r.text() };
  }, capturedHeaders);
  if (r.s !== 200) throw new Error('import-jobs HTTP ' + r.s + ': ' + r.t);
  const jobs = JSON.parse(r.t).importJobs || [];
  job = jobs.find(j => j.items?.some(it => it.data?.boardId === payload.boardId)) || null;
  if (job?.status === 'COMPLETED' && job.items?.[0]?.error) {
    throw new Error('Import failed: ' + JSON.stringify(job.items[0].error));
  }
  if (job?.items?.[0]?.result?.paperIds?.[0]) break;
  await sleep(2000);
}
const mindmapId = job.items[0].result.paperIds[0];
```

## Pós-condição obrigatória

- A URL https://app.ayoa.com/mindmaps/<paperId> deve carregar com
  node[contenteditable] ou text no SVG. Verificar com page.evaluate:
  document.querySelector('text,[contenteditable=true],[class*=node]').
- O central node deve ter o texto exato do <title> do OPML ou do
  primeiro <outline text="..."> quando o title estiver vazio.
- Se o canvas mostrar 0 slides, o user precisa clicar Auto-create no
  painel Presenter (ou rodar azoa-presenter.js --mode prepare).

## Anti-padrões

- Confiar no 204 do POST /v2/import/text como prova de criação: o
  status retornado é só "aceito na fila", não "mapa pronto". Sempre
  pollar import-jobs e validar paperIds[0].
- Confiar em mindmapId === null como falha: o servidor pode devolver
  status:COMPLETED mesmo com error:INTERNAL_ERROR. O mindmapId pode
  existir (a boardId é criada) mas o paperId resultante pode ser null.
- Mandar Content-Length errado em POST /v2/import/text: o servidor
  devolve 411 sem o header. Sempre use JSON.stringify no body e deixe
  o fetch/xhr calcular.
- Reutilizar o mesmo x-client-id em requests paralelas: Ayoa pode
  retornar 429 se duas requests com mesmo clientId chegarem em < 50ms.
  Gere um UUID por request.

## Verificacao externa (pytest tests/)

A skill carrega em `scripts/tests/fixtures/` 4 OPMLs reais (waico-maco 33 nos,
Copa 2026 Argentina x Espanha 49 nos em 3 variantes). O script
`scripts/tests/_pyayoa_opml.py` (stdlib only) e o modulo
`scripts/lib/opml-parser.js` devem produzir o mesmo shape
(title/central/nodeCount/maxDepth/texts) sobre os mesmos fixtures. O
`tests/test_opml_import.py` (pytest) blinda esse invariante atraves de 22
casos; em ambientes sem Node, `pytest tests/` sozinho cobre parsing,
boardName derivation e estrutura interna. Em ambientes com Node, `npm test`
adiciona 231 casos (Puppeteer real contra Chromium headless_shell do
Termux) mais 9 casos de `tests/ayoa-import-pick-input.test.js` (predicado
puro) e 1 caso de `tests/ayoa-import-puppeteer.test.js` (monta o DOM Ayoa
via `page.setContent`).
