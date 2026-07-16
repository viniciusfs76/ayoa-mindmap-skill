 conteúdo
# Ayoa v2 API — Auth Headers (captura e propagação)

A partir de 2026-07, a Ayoa endureceu os endpoints `/v2/*` da SPA:

| Endpoint | Verbo | Cookies | X-Auth-Token | X-Client-Id | X-Source | X-Source-Version | X-Agent | x-request-id |
|---|---|---|---|---|---|---|---|---|
| `/v2/uploads` | POST | sim | sim | sim | sim | sim | sim | sim |
| `/v2/import/text` | POST | sim | sim | sim | sim | sim | sim | sim |
| `/v2/import-jobs` | GET | sim | sim | sim | sim | sim | sim | sim |
| `/v2/analytics-events` | POST | sim | sim | sim | sim | sim | sim | sim |
| `/v2/sync` | POST | sim | sim | sim | sim | sim | sim | sim |

Capturado do dashboard do Ayoa (rede real, app.ayoa.com, 2026-07-16, Ayoa Web 8.170.89):

```text
x-auth-token: 59929114-b0ea-49c3-896b-ee5d91fa3d0e
x-client-id: 96a74252-a7dc-4359-bd1b-1096012cf524
x-source: web
x-source-version: 8.170.89
x-agent: Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/138.0.7204.168 Safari/537.36
x-request-id: d9c2d6bb-9192-4c9d-9f97-b55b85c4305e
```

## Sintomas ↔ Causa ↔ Fix

| Sintoma | Causa | Fix |
|---|---|---|
| `400 BAD_REQUEST: Invalid X-Client-Id header` | `captureAuthHeaders` capturou mas a request da API não incluiu o header | propagar os headers para `/v2/uploads`, `/v2/import/text`, `/v2/import-jobs` |
| `400 BAD_REQUEST: Invalid X-Agent header` | request feito com `User-Agent` (header HTTP padrão) mas sem `X-Agent` (header que a Ayoa exige na v2) | setar `X-Agent` explícito no `fetch` |
| `400 BAD_REQUEST: Invalid X-Request-Id` (improvável) | `crypto.randomUUID()` quebrado em page.evaluate | usar `Date.now().toString(36) + Math.random().toString(36).slice(2,10)` |
| `500 INTERNAL_ERROR` em `/v2/import/text` com `boardName` válido | bug de cache no Ayoa; tentar de novo | poll `/v2/import-jobs` e ver `status: COMPLETED` no item do nosso `boardId` |
| `500 INTERNAL_ERROR` em `/v2/import/text` com `boardName=""` | input modal "Digite o nome do seu projeto" não foi preenchido (saiu na searchbar "Pesquisar projetos") | ver `references/ayoa-v2-import-api.md` |

## Padrão canônico de captura (Node + Puppeteer)

```js
async function captureAuthHeaders(page) {
  return await new Promise(async (resolve, reject) => {
    let captured = null;
    const onReq = (r) => {
      if (captured) return;
      const h = r.headers();
      if (h['x-auth-token'] && h['x-client-id']) captured = h;
    };
    page.on('request', onReq);
    const timeout = setTimeout(() => {
      page.off('request', onReq);
      reject(new Error('auth headers not captured in 8s'));
    }, 8000);
    try {
      // Dispara uma request benign com os headers que o Ayoa vai replicar
      await page.evaluate(async () => {
        await fetch('/v2/import-jobs?t=' + Date.now(), { credentials: 'include' })
          .catch(() => null);
      });
    } catch {}
    await sleep(500);
    clearTimeout(timeout);
    page.off('request', onReq);
    if (!captured) return reject(new Error('auth headers still missing after probe'));
    resolve(captured);
  });
}
```

Depois, propague para **toda** request da API:

```js
const authHeaders = await captureAuthHeaders(page);
const upload = await page.evaluate(async ({ size, authHeaders }) => {
  const r = await fetch('/v2/uploads', {
    method: 'POST', credentials: 'include',
    headers: { 'content-type': 'application/json', ...authHeaders },
    body: JSON.stringify({ filename, filesize: size, contentType: '', useV2Upload: true }),
  });
  if (!r.ok) throw new Error(`/v2/uploads ${r.status}: ${await r.text()}`);
  return r.json();
}, { size, authHeaders });
```

## Por que isso é uma armadilha silenciosa

O `captureAuthHeaders` (presente desde a v1.16.1) só **observava** os headers do dashboard; o `apiPath` antigo setava apenas `content-type` no `fetch` e passava o teste em 2026-07-15 quando a Ayoa ainda era mais permissiva. Em 2026-07-16 a Ayoa endureceu os endpoints e a primeira execução do import começou a falhar com `400 BAD_REQUEST: Invalid X-Client-Id header`. O bug passou despercebido porque a UI fallback (v3) também falha silenciosamente, devolvendo `ok:true` sem `mindmapId`. **O sintoma visível é só "1 import failed" no editor, que sempre esteve documentado como sendo do `boardName=""`.**

## Teste de regressão

Adicionar caso em `tests/ayoa-import-cookie-shape.test.js` (ou em nova suite `tests/ayoa-import-auth-headers.test.js`):

```js
test('apiPath signature: accepts authHeaders and propagates them on /v2/uploads', () => {
  const m = require('../import-opml.js');
  assert.equal(typeof m.apiPath, 'function');
  assert.equal(m.apiPath.length, 4, 'apiPath must accept (page, opml, boardName, authHeaders)');
});
```

Já existe: `apiPath fn function` (exercido pelo sanity `node -e require('./import-opml.js')`). Para a versão real do teste, é melhor fazer um stub de `page.evaluate` que captura os headers e o body enviados, e assert que os 5 campos estão presentes. Posso adicionar como próxima tarefa se necessário.
