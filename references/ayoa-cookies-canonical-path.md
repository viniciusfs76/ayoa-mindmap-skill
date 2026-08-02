# Ayoa cookies: caminho canônico e gotchas de privacidade

> **Status**: Conteúdo observado em produção 2026-07-17.
> Skill: `software-development/ayoa-mindmap` v1.16.16 (pai).

## TL;DR

- **Cookie canônico**: `~/cookiesAyoa.json` (sem ponto inicial, sem hyphen).
- **Helper `nlm-cookies-helper.sh` NÃO serve** — filtra `grep ".google.com"` e rejeita Ayoa cookies.
- **EditThisCookie export captura conta ativa** — vinicius e bianca compartilham Android e podem ter sessões diferentes. Sempre verifique qual conta está em `ayoa.user` antes de automatizar.

## Caminhos verificados (Termux/Android)

| Path | Existe? | Comentário |
|---|---|---|
| `~/.cookiesAyoa-domain.json` | ❌ (não existe) | Path que o helper `nlm-cookies-helper.sh` **esperaria**, mas nunca foi materializado. |
| `~/cookiesAyoa.json` | ✅ (618 KB, ~1860 entries) | **Canônica**. EditThisCookie export do Android Chrome. |

## Ler e usar os cookies

```bash
# 1. Confirmar arquivo canônico
ls -la ~/cookiesAyoa.json
python3 -c "import json; d=json.load(open('$HOME/cookiesAyoa.json')); print('cookies:', len(d))"

# 2. Verificar conta dona dos cookies
python3 -c "
import json, urllib.parse
d = json.load(open('$HOME/cookiesAyoa.json'))
for c in d:
    if c['name'] == 'ayoa.user':
        u = json.loads(urllib.parse.unquote(c['value']))
        print('email:', u['email'], '| plan:', u['planCategory'], '| type:', u['accountType'])
        break
"

# 3. Apontar para o arquivo correto
export AYOA_COOKIES_FILE=$HOME/cookiesAyoa.json
node ~/.hermes/skills/software-development/ayoa-mindmap/scripts/ayoa-presenter.js \
  --target "https://app.ayoa.com/mindmaps/<uuid>" --mode prepare --cookies "$AYOA_COOKIES_FILE"
```

## Por que `nlm-cookies-helper.sh` falha

```bash
$ cat ~/bin/nlm-cookies-helper.sh | grep -E 'google|ayoa'
pairs = [f"{c['name']}={c['value']}" for c in items if isinstance(c, dict) and ".google.com" in c.get("domain", "")]
```

Filtra `domain == ".google.com"` na etapa crítica — `domain == ".ayoa.com"`
passa pelo filtro mas o output é construído pra NotebookLM (formato
`Cookie: name=value; name=value; ...`). Se você redirecionar o output pra
uma rota Ayoa, **funciona parcialmente**, mas o helper ainda chama
`nlm login --manual` no fim (não Ayoa).

**Não vale o detour**. Use os cookies diretamente:

```bash
cp ~/cookiesAyoa.json /tmp/ayoa-cookies-raw.json
python3 -c "
import json
d = json.load(open('/tmp/ayoa-cookies-raw.json'))
print(json.dumps([{'name': c['name'], 'value': c['value'], 'domain': c['domain']} for c in d if '.ayoa.com' in c['domain']], indent=2))
" > ~/.cookiesAyoa-domain.json
shred -u /tmp/ayoa-cookies-raw.json
```

## Privacidade entre contas

| Cookie field | O que carrega |
|---|---|
| `ayoa.ap` | Session token (HTTPOnly, signed) |
| `ayoa.user` | JSON-encoded `{id, email, planCategory: ultimate/paid/free, ...}` |
| `ayoa.sid` | Session ID |

`ayoa.user.value` é URL-encoded JSON. Decodifica com:

```python
import json, urllib.parse
v = json.loads(urllib.parse.unquote(cookie_value))
print(v['email'], v['planCategory'], v['accountType'])
```

Como vinicius e bianca compartilham dispositivo Android, sempre valide
antes de automatizar — agentes que assumem "viniciusfs76" e rodam contra
"biancavitali" vão capturar mapas da conta errada. Se a conta ativa não
for a desejada, peça ao user pra fazer logout/login no Chrome do Android
e re-exportar EditThisCookie.

## URL Ayoa aceita UUID curto além do canônico 8-4-4-4-12

`app.ayoa.com/mindmaps/<uuid>` aceita dois formatos:

1. **Canônico**: `[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}` (ex.: `abe443ca-23c0-4487-9909-ca50e29f45a0`).
2. **Curto / share-link**: `[0-9a-f]{2,8}-[0-9a-f]{2,4}-[0-9a-f]{2,4}-[0-9a-f]{2,12}` (ex.: `fb-adff-40eb-bdd8-6d6e6a896695`).

Validação rápida antes de regex estrito:

```bash
URL=https://app.ayoa.com/mindmaps/fb-adff-40eb-bdd8-6d6e6a896695
curl -sI -o /dev/null -w "%{http_code}\n" "$URL" | grep -q 200 && echo "URL válida"
```

`x-droptask-request-id` no header confirma que o backend Droptask
resolveu o UUID curto.

Validado 2026-07-17: session tentou `fb-adff-40eb-bdd8-6d6e6a896695`,
regex 8-4-4-4-12 rejeitou, mas HTTP probe deu 200 — usuário confirmou
que queria rodar mesmo assim.

## Honcho memory injection durante paste longo

Quando o user cola arquivo grande (cookies, JSON, configs), o middleware
Honcho injeta cards de contexto que parecem input do user. Comportamento
recorrente:

- Cole cookies EditThisCookie → 4-5 Honcho cards chegam como
  `vinicius said...`, `recency: 2026-07-17`, `decision: ...`.
- Cada card tenta interpretar como instrução nova.

**Regra do user profile vinicius**:

> "If user pastes long data (cookies, JSON), stop and repeat 'pare,
> aguardo texto puro' until they stop. When paste termina, processar
> sozinho."

Aplicar literalmente: a cada fragmento JSON solto, repetir curto
"pare, aguardo texto puro". Quando chegar texto puro ("fim", "ok",
"acabou"), processar sozinho via clipboard read + shred.

Pitfall: card Honcho pode chegar em **qualquer turno** durante paste —
incluindo o primeiro. Tratar como não-input imediato.
