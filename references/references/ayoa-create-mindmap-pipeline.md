# Ayoa Create-Mindmap Pipeline — caminho canônico end-to-end

**Data de validação real:** 2026-07-16
**Mapa criado:** `https://app.ayoa.com/mindmaps/d0b3c41e-8025-42e3-9246-787edbca46e9`
**Fonte:** `world-cup-final-2026-strict.opml` (49 nós, 8 ramos, profundidade 2)
**Resultado:** `npm test` 231/231 verde, `pytest tests/` 22/22 verde, 50 slides gerados, MP4 2.6 MB / 1m1s em `~/storage/downloads/final-copa-2026-apresentacao.mp4`.

## Quando usar este pipeline

O usuário pediu: "crie mapa mental da final da Copa 2026" (ou qualquer outro tema). Existem dois caminhos:

| Caminho | Quando | Comando |
|---|---|---|
| **API direta v2** (recomendado, deterministic) | Cookies Ayoa disponíveis, OPML válido, quer garantir criação sem UI do user | `node scripts/ayoa-create-mindmap-from-opml.js --cookies ~/tmp/ayoa-cookies.json --opml ~/tmp/world-cup-final-2026-strict.opml --name "..."` |
| **UI flow (3 cliques manuais)** | Cookies Ayoa indisponíveis/expirados ou browser do user já autenticado | carregar `references/ayoa-opml-agent-manual.md` e seguir passos 1–3 |

**Não tente** import headless sem ter o conjunto completo de cookies Ayoa (mínimo 9 entradas `.ayoa.com` incluindo `ayoa.ap`+`ayoa.sid`+`ayoa.user`). Sem isso, Ayoa redireciona para `auth.ayoa.com/login` mesmo que `expirationDate` esteja futura. Detalhes em `references/ayoa-2-hop-login-fix.md`.

## Pré-condições

- `chromium headless_shell` em `$PREFIX/lib/chromium/headless_shell` (já vem no Termux).
- `puppeteer-core` (já em `scripts/node_modules`).
- Cookies Ayoa em JSON array (formato EditThisCookie). Carregar via `termux-clipboard-get` → arquivo chmod 600 → `shred -u` no fim.
- OPML válido em `~/tmp/<slug>.opml` ou similar. Validar antes: `node -e "console.log(JSON.parse(require('fs').readFileSync('OPML','utf8')))"` (deve parsear como XML).

## API direta v2 — passo a passo

1. **2-hop login** (canonical, em `scripts/ayoa-login.js`):
   - `await page.goto('https://www.ayoa.com/')` com `waitUntil:'domcontentloaded'`
   - injetar cookies **um por um** (filtrar `sameSite:'unspecified'` → `Lax`; pular `__Host-*`)
   - `await page.goto('https://app.ayoa.com/')`; sleep 7s
   - **Verificação vinculante:** se a URL final for `auth.ayoa.com/login?...`, abortar — a sessão foi invalidada pelo servidor (a expiração dos cookies é apenas metadado, não prova de validade).

2. **Capturar auth headers** do tráfego do dashboard:
   ```js
   page.on('request', r => {
     if (r.headers()['x-auth-token'] && r.headers()['x-client-id']) headers = r.headers();
   });
   // Provocar 1 request inofensivo: page.evaluate(fetch('/v2/import-jobs?t='+Date.now(), { credentials:'include' }));
   ```
   Os 5 headers críticos: `x-auth-token`, `x-client-id` (UUID v4 por request!), `x-source` (sempre `"web"`), `x-source-version` (ex: `"8.170.89"`), `x-agent` (User-Agent).

3. **`POST /v2/uploads`** para pré-sinalizar URL no S3:
   ```js
   fetch('/v2/uploads', { method:'POST', credentials:'include', headers:{'content-type':'application/json'},
     body: JSON.stringify({ filename, filesize: Buffer.byteLength(opmlContent), contentType:'', useV2Upload:true })
   });
   ```
   Resposta 200: `{ url: 'https://droptask-attachments-1.s3.amazonaws.com/...', form: <AWS policy> }`.

4. **PUT no S3** com o `FormData` montado a partir de `form.fields` + Blob do OPML:
   ```js
   const fd = new FormData();
   for (const k of Object.keys(form.fields)) fd.set(k, form.fields[k]);
   fd.set('file', new Blob([opmlContent], { type:'text/x-opml' }));
   await fetch(form.url, { method:'POST', body: fd, credentials:'omit' });
   ```
   Status esperado: 204. Erro 4xx/5xx significa que o S3 rejeitou o upload (chave inválida, expiração de policy, etc.).

5. **`POST /v2/import/text`** com o body canônico. **Pitfall crítico:** `boardName` não pode ser string vazia — Ayoa retorna 204 mas o `import-jobs` mostra `error:{code:INTERNAL_ERROR}` e o mapa nunca aparece. Sempre derivar do OPML `<title>` (ou do primeiro `<outline text="...">`):
   ```js
   const boardName = deriveBoardName(opmlContent, override);  // exportado de scripts/import-opml.js
   if (!boardName || !boardName.trim()) throw new Error('boardName vazio causaria 500');
   const boardId = 'board-' + Math.random().toString(36).slice(2,10) + '-' + Date.now().toString(36);
   await fetch('/v2/import/text', { method:'POST', credentials:'include', headers:{'content-type':'application/json'},
     body: JSON.stringify({ fileUrl: upload.url, fileName: filename, type:'TEXT_FILE', boardName, themeId:'organic_v2', boardId })
   });
   ```
   Status esperado: 204. NÃO confie no 204 — sempre polle `import-jobs`.

6. **Polling `GET /v2/import-jobs?t=<ms>`** propagando os 5 headers críticos:
   ```js
   for (let i = 0; i < 12; i++) {
     const r = await fetch('/v2/import-jobs?t='+Date.now(), {
       headers: { 'x-auth-token': h['x-auth-token'], 'x-client-id': crypto.randomUUID(),
                  'x-source':'web', 'x-source-version': h['x-source-version'], 'x-agent': h['x-agent'],
                  'x-requested-with':'XMLHttpRequest' },
       credentials:'include'
     });
     const jobs = (await r.json()).importJobs || [];
     const job = jobs.find(j => j.items?.some(it => it.data?.boardId === boardId));
     if (job?.items?.[0]?.error) throw new Error('Import failed: ' + JSON.stringify(job.items[0].error));
     if (job?.items?.[0]?.result?.paperIds?.[0]) return job.items[0].result.paperIds[0];
     await sleep(2000);
   }
   throw new Error('Polling timeout for boardId ' + boardId);
   ```

7. **Verificar pós-condição** navegando para `https://app.ayoa.com/mindmaps/<paperId>` e validando o canvas:
   ```js
   await page.goto('https://app.ayoa.com/mindmaps/' + paperId, { waitUntil:'domcontentloaded' });
   await sleep(15000);  // Ayoa monta o canvas em 8-18s
   const ok = await page.evaluate(() =>
     document.querySelector('text,[contenteditable=true],[class*=node]') !== null
   );
   if (!ok) throw new Error('Editor did not mount: no node found');
   ```

## Selecionar o input certo para o título

Ayoa tem DOIS inputs visíveis no estado inicial do dashboard:

1. `<input placeholder="Pesquisar projetos">` — searchbar global (NÃO usar)
2. `<input placeholder="Digite o nome do seu projeto">` — modal de criação (usar este)

`scripts/import-opml.js` exporta o predicado `pickBoardNameInput(candidates)` que cobre os sinônimos em PT-BR, EN e ES. SEMPRE usar este predicado, nunca "primeiro input visível" (que será a searchbar).

## Fix de typing para React/Input controlado

```js
inp.focus();
const proto = Object.getPrototypeOf(inp);
const setter = Object.getOwnPropertyDescriptor(proto, 'value').set;
setter.call(inp, title);
inp.dispatchEvent(new Event('input',  { bubbles:true }));
inp.dispatchEvent(new Event('change', { bubbles:true }));
inp.dispatchEvent(new Event('blur',   { bubbles:true }));
```

Sem o setter nativo + os 3 dispatches, o React não atualiza o state e o Ayoa envia `boardName:""` no payload.

## Anti-padrões documentados

- **Confiar no 204** do `POST /v2/import/text` como prova de criação: é só "aceito na fila", não "mapa pronto". Sempre pollar `import-jobs`.
- **Reutilizar o mesmo `x-client-id`**: Ayoa pode retornar 429. Gere UUID por request.
- **Mandar `Content-Length` errado** no POST manual: servidor devolve 411. Use `JSON.stringify` e deixe o runtime calcular.
- **`setCookie` direto em `app.ayoa.com`** sem 2-hop: cai no redirect `auth.ayoa.com/login`.
- **Skipping 1ª/2ª input visível**: o predicado `pickBoardNameInput` está exportado justamente para evitar esse bug.
- **Confiar em `expirationDate` dos cookies**: a sessão pode ser invalidada antes da expiração declarada. A URL após o 2-hop é a única prova vinculante.

## Validação E2E realizada

- 2026-07-16: mapa `d0b3c41e-8025-42e3-9246-787edbca46e9` criado a partir de `world-cup-final-2026-strict.opml` (49 nós, 8 ramos).
- Screenshot em `~/.ayoa-final-copa-2026-created.png` mostra o central node "WORLD CUP FINAL 2026 - ARGENTINA VS SPAIN" renderizado, com 7 dos 8 ramos visíveis na viewport.
- `GET /v2/import-jobs` após polling: `paperIds:["d0b3c41e-…-46e9"]`, `status:COMPLETED`, `error:null`.
- `nodeCountExpected:49`, `maxDepth:2`, `jobStatus:"COMPLETED"`, `apiStatus:204` — todos verificados por `scripts/ayoa-import-opml.js` (auto-test).

## Próximos passos após o import

- Rodar `node scripts/ayoa-presenter.js --mode prepare` para popular o deck (50 slides para 49 nós + central).
- Rodar `node scripts/ayoa-capture-slides.js --wait 1200` (~1.3s/slide + overhead; 50 slides = ~70s).
- Rodar `node scripts/ayoa-video.js --fps 1 --crf 23` (~5s para 50 frames).
- Mover o MP4 para `~/storage/downloads/<slug>-apresentacao.mp4` e abrir com `termux-open`.

## Referências irmãs

- `references/ayoa-v2-import-api.md` — contrato exato dos endpoints, headers, tabela de erros.
- `references/ayoa-2-hop-login-fix.md` — 2-hop login + filtros de cookie.
- `references/ayoa-import-opml.md` — receita operacional manual de 3 cliques (fallback).
- `references/ayoa-opml-agent-manual.md` — manual do agente com labels localizados.
- `references/ayoa-learned-cases.md` — casos #007 e #008 com timeline completa.
- `scripts/tests/ayoa-import-pick-input.test.js` — 9 casos puros para o predicado.
- `scripts/tests/ayoa-import-puppeteer.test.js` — 1 caso Puppeteer real (Chromium headless_shell).
- `scripts/import-opml.js` — implementação canônica reutilizável; exporta `pickBoardNameInput`, `deriveBoardName`, `normaliseCookie`, `parseOpml`.
