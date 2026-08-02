## **AVISO IMPORTANTE (leia primeiro)** — path para mudar tema

Mutações em mapas existentes via `/v2/sync` (incluindo `/themeId`,
`/branchThickness`) **retornam 204 OK mas NÃO persistem** — o Ayoa roteia
mutations de paper via **Centrifugo WebSocket** (o `channelId` vem de
`POST /v2/client`, não de `/v2/sync`). 6 shapes de patch testadas contra
mapa `43e22adb-…` em 2026-07-16 confirmaram 0 persistência.

**Se o user pedir "mudar tema/branch style para todos os nós de um mapa
existente", NÃO tente PATCH. Reimporte** com `scripts/import-opml.js
--theme-id X` (v1.16.11+). Esse é o único caminho programático que
funciona hoje — `import-text` aceita e persiste `themeId` direto.

```bash
node scripts/import-opml.js \
  --cookies ~/.cookiesAyoa-domain.json \
  --opml ~/tmp/<original>.opml \
  --theme-id radial   # box, capture, direction, dsa, organic,
                      # organic_dsa, organic_v2 (default), radial, speed
```

Resto do doc abaixo descreve o envelope para os casos em que PATCH ainda
for tentado (use `--dry-run` em `scripts/ayoa-apply-theme.js` para emitir
o JSON sem chamar `/v2/sync`).

---

# Ayoa v2 `/v2/sync` — JSON Patch contract (Capturado 2026-07-16)

## Visão geral

A Ayoa usa **`POST /v2/sync`** como ponto único de mutação para o canvas de mindmap.
Mensagens trafegam como **JSON Patch (RFC 6902)** encapsuladas num envelope
proprietário com 6 headers HTTP obrigatórios. Toda mutação de mapa que a UI faz
(long-press → Formatação → Tema, criar/editar/mover/apagar nó, branch style,
mudança de espessura) vai pelo mesmo endpoint com shapes diferentes de
`messages[].data.patches[]`.

## Headers obrigatórios (todos ao mesmo tempo)

```
x-auth-token       : <uuid-v4>      ← do /v2/client (não confundir com cookie de sessão)
x-client-id        : <uuid-v4>      ← mesmo id que o /v2/client retorna
x-source           : web
x-source-version   : 8.170.89       ← muda entre versões do Ayoa Web
x-agent            : <UA completo>  ← Ayoa rejeita se não parecer browser
x-request-id       : <uuid-v4>      ← para tracing server-side
```

Sem `x-auth-token` → 400 `Invalid X-Auth-Token header`.
Sem `x-client-id` → 400 `Invalid X-Client-Id header`.
Mesmo com 200, a mutation só persiste se TODOS os headers forem válidos.

## Shape do envelope (capturado do probe real)

```json
POST /v2/sync
Content-Type: application/json
{
  "messages": [{
    "_id": "<uuid-v4>",                ← id da mensagem (não usar duas vezes iguais)
    "timestamp": "2026-07-16T16:41:25.796Z",
    "data": {
      "type": "USER",                  ← tipo do ator (USER | SYSTEM)
      "id": "<userId>",                ← id do usuário logado (= j.user._id)
      "patches": [                     ← array de operações JSON Patch-like
        {
          "op": "UPDATE",              ← só UPDATE foi observado
          "path": "/themeId",          ← caminho absoluto no paper
          "value": "radial",           ← novo valor
          "_p0": { "matchKey": "<paperId>" }  ← se o patch requer resolução de entidade
        }
      ]
    },
    "clientId": "<uuid-v4>",           ← mesmo do x-client-id
    "type": "UPDATE_ENTITY",            ← tipo do envelope externo
    "sent": false,                     ← flag de envio (Ayoa atualiza)
    "userId": "<userId>",              ← redundante com data.id
    "paperId": "<paperId>"             ← alvo da mutation
  }],
  "numberQueuedMessage": 1
}
```

## Como capturar `userId` e headers via CDP

`page.evaluate(fetch('/v2/init'))` BLOQUEIA em `/v2/init` (response de 8.5 MB
com 1000+ papers) e não retorna. Solução: ouvir via CDP `page.on('response')`.

```js
let captured = null;
page.on('request', r => {
  if (captured) return;
  if (r.url().includes('app.ayoa.com/v2/')) {
    const h = r.headers();
    if (h['x-auth-token']) {
      captured = {
        'x-auth-token': h['x-auth-token'],
        'x-client-id': h['x-client-id'],
        'x-source': h['x-source'],
        'x-source-version': h['x-source-version'],
        'x-agent': h['x-agent'],
      };
    }
  }
});
// Trigger: dashboard fires /v2/analytics-events a cada ~30s após login.
await page.goto(`https://app.ayoa.com/mindmaps/${MINDMAP_ID}`, {waitUntil:'domcontentloaded'});
// Espera até 10s pela primeira /v2/.

let userId = null;
page.on('response', async r => {
  if (userId) return;
  if (r.url().includes('/v2/init')) {
    const j = await r.json();
    userId = j.user._id;
  }
});
```

## Campos top-level do paper (descobertos via `/v2/init`)

Cada paper retornado em `/v2/init` tem, entre outros, estes campos passiveis de
JSON Patch direto (`path: /<campo>`, sem `_p0.matchKey`):

| Campo | Tipo | Observação |
|---|---|---|
| `themeId` | enum (`box`/`capture`/`direction`/`dsa`/`organic`/`organic_dsa`/`organic_v2`/`radial`/`speed`) | themeId global do mapa |
| `branchThickness` | number | slider da doc oficial |
| `branchColourSettings` | object | configurações de cor por nível |
| `branchLabelColourMatch` | bool | label segue cor do branch |
| `layoutType` | enum | `organic`/`radial`/etc |
| `levelWidths` | array | largura por profundidade |
| `depthSettings` | object | até onde expandir por padrão |
| `boardFontFamily` | string | font global |
| `boardFontSize` | number | tamanho base |
| `backgroundColor` | hex | cor do canvas |

Patches aninhados exigem `_p0: { matchKey: <paperId> }` (ex.: `/paperSettings2/_p0/lastOpenedAt`).

## Pitfalls confirmados

1. **Status 204 não garante persistência — confirmado em 6 shapes.**
   Vimos 204 OK com PATCH `/themeId` e `/branchThickness` em `/v2/sync` mas
   o `themeId`/`branchThickness` do paper continuou inalterado em
   `/v2/init?paperIds[]=...` reconsultado. **Causa raiz provável:** Ayoa
   roteia mutations de paper via **Centrifugo WS** (note `POST /v2/client`
   retorna `channelId` para Centrifugo), não REST `/v2/sync`. **Path
   alternativo comprovado:** `scripts/import-opml.js --theme-id X` (v1.16.11+).
   **Próximo passo se o path Centrifugo precisar ser descoberto:** sniff
   passivo durante uma sessão Formatar real (não automatizada) usando
   `scripts/ayoa-capture-while-formatting.js`.

2. **`fetch()` em `page.evaluate` para `/v2/init` trava.** Use
   `page.on('response')` para ler o body via CDP; ou aplique um timeout curto
   (3s) e siga com headers via `x-client-id` do `/v2/analytics-events`.

3. **`numberQueuedMessage` deve ser igual ao tamanho de `messages[]`.** Ayoa
   rejeita (ou ignora silenciosamente) se o número não bater.

4. **`paperId` no nível da mensagem é informativo; o roteamento real usa
   `_p0.matchKey` no patch.** Para paths aninhados (`/paperSettings2/_p0/...`),
   o `_p0.matchKey` é mandatório. Para paths top-level (`/themeId`),
   omiti-lo retorna 204 ack mas não persiste — ver pitfall #1.

## Script canônico

`scripts/ayoa-apply-theme.js` implementa o envelope completo. Hoje falha para
`themeId` (pitfall #1); pode estar OK para `branchThickness`, `layoutType`,
`backgroundColor` (paths top-level mais simples). Use `--dry-run` para emitir o
JSON sem chamar `/v2/sync`.

```bash
node scripts/ayoa-apply-theme.js \
  --target https://app.ayoa.com/mindmaps/<uuid> \
  --themeId radial --dry-run
```