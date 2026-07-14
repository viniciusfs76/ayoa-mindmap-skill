# Equivalências verificadas — documentação histórica × interface atual

**Última inspeção:** 2026-07-14
**Interface observada:** Ayoa Web 8.170.88, viewport 1440×900, Mind Map “Brasil Mais Digital”.

Esta referência complementa, sem duplicar,
[`present-mode-version-matrix.md`](present-mode-version-matrix.md), que é a fonte
curta de equivalências. Use este arquivo para o procedimento adaptativo e para
registrar divergências observadas fora da matriz principal.

## Regra de manutenção

Textos, posições, ícones, classes e seletores históricos são pistas, não invariantes.
Antes de cada automação:

1. espere o editor montar;
2. inspecione o DOM atual;
3. identifique o controle por função e estado;
4. execute a ação;
5. valide a transição resultante;
6. registre a equivalência nova se a UI divergir;
7. só então atualize `present-mode-version-matrix.md` e bumpe a skill.

Prioridade de resolução:

1. estado semântico observado;
2. estrutura DOM atual;
3. texto/ARIA atual;
4. classe atual;
5. posição visual;
6. nome/seletor histórico apenas como fallback.

## Divergências comportamentais observadas

- **Histórico:** Start abria a experiência diretamente em fullscreen.
  **Atual:** Start ativa `.presenting`; Fullscreen é ação separada.
- **Histórico:** `Add all`. **Atual:** `Auto-create`.
- **Histórico:** `bookmarks` tool. **Atual:** seleção do elemento + `Add`.
- **Histórico:** `collapse` do menu. **Atual:** `Compact`, que desmonta a lista do DOM.
- **Histórico:** `live share` (duas telas). **Atual observado:** `Dual Screen (Beta)`,
  controlador separado e janela `?presentationWindow=1#mindmaps/<id>`.
- **Atual:** `Start` redefine assincronamente o primeiro slide; revalidar/restaurar
  `startAt` após a ativação.

## Posições observadas — somente diagnóstico

Em 1440×900, na inspeção de 2026-07-14:

- Present: x≈994, y≈59;
- Play/Stop: x≈1141, y≈352–568, conforme o estado;
- Fullscreen/Compact: rodapé do controlador;
- painel: lateral direita.

Nunca clicar por essas coordenadas sem reinspecionar. Layout, viewport, idioma, sidebars
e experimentos A/B podem deslocá-las.

## Contrato adaptativo para scripts

- `openPresenter`: detectar painel já aberto antes de clicar o toggle.
- `preparePresentation`: parar estado `.presenting` persistido; preservar deck.
- `startPresentation`: selecionar o primeiro slide, clicar Start, aguardar reset da UI,
  restaurar `startAt` e esperar o canvas assentar.
- `navigatePresentation`: preferir controles DOM, validar mudança de `activeId`, esperar
  zoom/pan; teclado é fallback.
- `setCompactMode`: cachear deck e slide ativo antes do clique.
- `setFullscreenMode`: validar estado da UI, não apenas `document.fullscreenElement`.
- `stopPresentation`: confirmar `presenting=false` sem reduzir `slideCount`.
- `runFullPresentation` (driver canônico): combina tudo acima e adiciona
  `verifyPlanCompatibility`, `locatePresentControl`, `classifyExistingPresentation`,
  `clearPresentationDeck`, `requestFullPresentation`, `selectFirstItem`,
  `hasForwardControl`, `confirmStepChange` e `buildPresentationMachine` para
  registrar cada transição com evidência e validar a pós-condição. Deve sempre
  terminar em `presentation_completed` ou `blocked`.

## Quando a interface mudar

Capture e registre, sem sobrescrever a história:

- versão/hash de assets do Ayoa;
- viewport e idioma;
- screenshot antes/depois;
- outerHTML/classes/ARIA dos controles;
- estado semântico antes/depois;
- equivalência histórica substituída;
- teste RED que reproduz a diferença;
- patch mínimo e resultado GREEN.
