# Cookie JSON Validation Cookbook (2026-07-19)

Receita operacional para diagnosticar problemas de cookies do Ayoa **antes** de
disparar o pipeline Puppeteer (~10min). Resolve três classes de falha que
apareceram em sessão headless real:

1. **JSON truncation** (clipboard race Android / partial download)
2. **Falso-positivo do validator canônico** (cookie de outro site expirado)
3. **Cookies Ayoa realmente válidos** mas validator reporta EXPIRED

## Tabela de decisão

| Sintoma | Causa | Ação |
|---|---|---|
| `Cookie preflight: LOAD_ERROR — Unterminated string` | JSON truncado | Re-export completo, validar `JSON.parse(fs.readFileSync(...))` |
| Validator reporta EXPIRED, mas Ayoa-cookies (`ayoa.ap` etc) `expired: false` | Falso-positivo (PPLX, NextAuth de outro site) | Prosseguir com `check-ayoa.js` como ground truth |
| Validator reporta EXPIRED E `ayoa.ap`/`ayoa.sid`/`ayoa.user` `expired: true` | Real expired | Re-export do Chrome |
| `Session established at: app.ayoa.com` mas preflight rejeita | JSON truncado (independente da auth) | Validar JSON, não confiar em 2-hop login |

## Checklist pré-pipeline

```bash
# 1. Confirma arquivo existe e tem tamanho razoável
ls -la ~/storage/downloads/cookiesAyoa.json
# Esperado: > 600KB (1860 cookies do EditThisCookie completo)

# 2. JSON.parse estrito (não aceita prefixo truncado)
node -e "const j=require('fs').readFileSync('~/storage/downloads/cookiesAyoa.json','utf8'); JSON.parse(j); console.log('OK',j.length,'bytes')"
# Se OK + > 600KB → arquivo íntegro

# 3. Ad-hoc check dos 3 críticos do Ayoa
node /data/data/com.termux/files/usr/tmp/check-ayoa.js ~/storage/downloads/cookiesAyoa.json
# Espera-se: ayao.ap, ayoa.sid, ayoo.user TODOS expired=false

# 4. (Opcional) Confirmar que login 2-hop estabelece sessão
cd ~/.hermes/skills/software-development/ayoa-mindmap
NODE_PATH=./node_modules node scripts/ayoa-login.js \
  --cookies ~/storage/downloads/cookiesAyoa.json --target https://www.ayoa.com/
# Espera-se: "Session established at: https://app.ayoa.com/"
```

Se qualquer passo falhar, **não prosseguir** com `import-opml.js` /
`ayoa-capture-slides.js` — risque 5-10min de Puppeteer + 1 cap cycle.

## Regras heurísticas

- **Cookies EditThisCookie são grandes**: 100KB+ para 1860 cookies. < 50KB é sinal
  forte de truncamento.
- **Clip race do Android**: copy-paste via clipboard do Termux tem limit
  silencioso (~60-100KB?). Sintoma típico: usuário cola "arquivo inteiro" e
  aparece truncado. Solução: salvar via Files do Android em
  `~/storage/downloads/` em vez de clipboard.
- **Domain filter**: EditThisCookie exporta cookies de **todos os domínios**
  (~200 domínios diferentes no dump típico: gmail, drive, github, notion, etc).
  Validator canônico procura por nomes genéricos (`__Secure-next-auth.session-token`,
  `__Secure-pplx.session`) que casam em vários sites. Sempre filtrar
  `c.domain.includes('ayoa.com')` antes de tomar decisão.
- **Os 3 críticos Ayoa** (verificados em 2026-07-19):
  - `ayoa.ap` (NextAuth JWT)
  - `ayoa.sid` (session ID)
  - `ayoa.user` (user identification)

  Esses 3 **precisam** estar `expired: false` para o login funcionar. Os outros
  (tracking: `_ga`, `_fbp`, `_gcl_au`, `_rdt_*`) não são necessários.

## Caveats

- **Cache de 5min do validator canônico.** Após re-export de cookies, rodar
  `rm -rf /tmp/cookie-validator-cache/` (ou invalidar via API se disponível).
  Caso contrário, EXPIRED antigo pode vir de cache.
- **`Session established at: app.ayoa.com`** é sinal positivo mas não
  garante: pode ser JSON truncado em arquivo separado. Sempre rodar o check
  JSON.parse estrito.
- **Cookie validator pode estar estale.** Se o validator falha mas o
  `ayoa-login.js` estabelece sessão e os 3 críticos estão `expired: false`,
  o validator está com bug — prosseguir.

## Validação real

**Caso 2026-07-19**: cookiesAyoa.json de 100003 B (~1860 cookies) truncado.
- `import-opml.js --cookies X.json` → `Cookie preflight: LOAD_ERROR`
- `node -e "JSON.parse(fs.readFileSync('X','utf8')).length"` → 1860 (aceita prefixo!)
- `node check-ayoa.js X.json` → 10 Ayoa-cookies, todos `expired: false`
- Diagnóstico: JSON truncation por clipboard race Android.

**Lição**: três parsers, três verdicts diferentes. O preflight estrito ganhou.