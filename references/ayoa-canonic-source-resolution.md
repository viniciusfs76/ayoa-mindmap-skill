# Resolvendo o doc "canônico" de um projeto no Drive

Quando o usuário pede um documento do Google Drive e o chama de "canônico", "oficial", "viva", "vigente", "atual", "fonte primária" (ou variantes PT-BR como "canônico", "viva", "de vocês"), **não** busque pelo título com modifTime mais recente. Esse padrão falha porque:

1. Derivados (mapas mentais, resumos, reflexões, versões MGI) são editados com mais frequência que a fonte.
2. Documentos duplicados (versões candidatas, backups, mirrors em inglês) aparecem com datas próximas.
3. O doc-fonte raramente é renomeado; derivados frequentemente copiam o título com sufixos.

## Padrão de resolução

Siga esta ordem e **explique ao usuário o que escolheu e por quê** antes de gerar o mapa, especialmente se o passo (1) falhar:

1. **Procure uma pasta `00_ADMIN_E_INDICE`** (ou `00_ADMIN`, `00_indice`, `_INDEX`, `_ADMIN`, `00_ORGANIZACAO`) dentro do diretório do projeto. Esses são índices vivos mantidos pelo dono do projeto. Leia-o e siga o link para o doc canônico.
2. **Procure `05_OUTPUTS_FINAIS`** (ou `04_OUTPUTS`, `FINAL`, `_VIVOS`, `outputs-final`) dentro do projeto. Versões canônicas moram aqui.
3. **Procure arquivos com `VIVO` ou `VIGENTE` no nome**, sem prefixo `Mapa Mental -` nem sufixo `- Release note` nem `- revisao`. O nome limpo é mais provável de ser a fonte.
4. **Só então** recorra ao modifTime como desempate, com filtro: ignore entradas cujo nome começa com `Mapa Mental -`, `- Release note`, `- Comparacao`, `- Backup`, `- Cópia`, `- Proposta hibrida`.

## Como ler o conteúdo do doc

- **Google Doc nativo** (`application/vnd.google-apps.document`): use `hermes-gapi docs get <id>`. Retorna JSON `{title, documentId, body}`.
- **Arquivo `.md` enviado ao Drive** (comum para projetos IPD): o `docs get` falha com 404 ou JSONDecodeError. Use `hermes-gdrive get <id>` ou baixe via `drive download <id> --output ~/tmp/<slug>.md`.
- Arquivos na pasta `00_ADMIN_E_INDICE` costumam ser `.md` (release notes, índices, atas).

## Caso concreto (2026-07-16)

Usuário pediu "doc canônico da proposta de portaria da IPD de vocês". Caminho errado teria sido pegar "Mapa Mental - PORTARIA IPD - Brasil Mais Digital v2 - Programa de Governo (Fase 183).md" (modifTime mais recente), que é um **resumo** (4 bullets curtos). Caminho certo:

- Pasta raiz: `IPD de VCs` (`1zMzFOYhHfUdFIoWqhDhsdDBTpfuMSGx0`).
- Subpastas padrão: `00_ADMIN_E_INDICE`, `01_FONTES_E_REFERENCIAS`, `02_NOTAS_DE_TRABALHO`, `03_ANALISES_INTERMEDIARIAS`, `04_OUTPUTS_EM_DESENVOLVIMENTO`, `05_OUTPUTS_FINAIS`, `90_HISTORICO_AUXILIAR`, `99_ARQUIVO_E_SUPERADOS`, `99_QUARENTENA`.
- Doc escolhido: `PORTARIA IPD - MAPA_DE_ARTEFATOS_E_VERSOES - VIVO` (`1SSgVM0jFcE03BeMQnN_qkzYvCOMa0yzNmUldTFzqVqs`, modifTime 2026-06-29T17:15:06) — versão `VIVO` sem sufixo de mapa-mental, morando em `00_ADMIN_E_INDICE`.

## Quando usar esta referência

- Usuário diz "canônico", "oficial", "principal", "fonte", "doc de vocês", "viva", "vigente".
- Pedido envolve criar mapa no Ayoa a partir de um documento Google.
- Existem ≥ 3 documentos com nome parecido (resumos, versões, reflexões).
- O modifTime mais recente bate com um resumo (não com a fonte).

## Anti-usos

- Não confie em `modifiedTime` sozinho.
- Não confie em prefixo `Mapa Mental -` para achar a fonte (são derivados).
- Não gaste mais que 2 chamadas de `hermes-gdrive search` antes de conferir a pasta `00_ADMIN_E_INDICE`.

## Para que serve o doc canônico depois de encontrado

Depois de identificar o doc canônico, **leia o índice dele** antes de decidir o que mapear. Em projetos IPD/WAICO, o canônico costuma listar sub-versões candidatas (v0.4, v0.5, v0.21-0.27) — escolha a **viva** marcada explicitamente como `OPERATIONAL` ou `VIGENTE` no texto, não a mais recente. Se o índice citar uma fase numérica (Fase 180, Fase 183), pergunte ao usuário antes de pular fases — pode haver gating institucional.