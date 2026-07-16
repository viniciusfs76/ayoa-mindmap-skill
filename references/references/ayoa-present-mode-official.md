# Ayoa Present mode — contrato oficial e fluxo validado

**Última verificação:** 2026-07-14  
**Ayoa Web observado:** 8.170.88  
**Fonte oficial principal:** https://support.ayoa.com/mind-mapping-tips-and-tricks  
**Índice oficial atual:** https://support.ayoa.com/mind-maps  
**Fonte oficial histórica inicial:** https://www.ayoa.com/ourblog/sharing-your-ideas-is-now-easier-than-ever-with-mind-map-present/

## O que a documentação oficial estabelece

O artigo oficial **“Mind Map extra features”** (28/07/2025), verificado ao vivo em
14/07/2026, afirma que:

- o **Present mode** comunica ideias em partes pequenas (“bite-sized chunks”);
- a navegação deve percorrer o projeto metodicamente, demonstrando a evolução das ideias;
- o usuário escolhe quais elementos entram na apresentação;
- o Ayoa progride pela seleção em uma ordem intuitiva;
- o recurso é exclusivo do **Ayoa Ultimate**;
- está disponível em **Mind Maps** e **Whiteboards**;
- o botão de apresentação abre a **present window** — termo oficial da documentação;
- na interface atual, essa janela corresponde ao painel lateral **Presenter/Apresentador**
  (`.slides-list-container`), antes do estado ativo `.presenting`;
- ramos podem ser adicionados individualmente: selecione o ramo no mapa e use
  **Add/Adicionar** na present window;
- o comando historicamente denominado **Add all** inclui todos os ramos do mapa;
- na interface atual, o comportamento equivalente é **Auto-create**, que gera o deck
  completo seguindo a estrutura/ordem do mapa;
- **Clear all** remove todos os ramos/slides da apresentação, sem apagar nem alterar
  os ramos correspondentes no mapa mental;
- a ordem dos ramos/slides pode ser reorganizada por drag-and-drop na present window;
- antes de iniciar, o primeiro ramo/slide da sequência deve estar selecionado;
- historicamente, **Start presenting** abria o modo de apresentação em tela cheia;
- as setas da interface ou do teclado avançam e retornam pelos ramos/slides na ordem
  definida na present window;
- **Stop presenting** encerra a apresentação e retorna ao estado de preparação, sem
  apagar o deck salvo;
- o recurso é associado ao plano **Ayoa Ultimate** e ao uso em **web/desktop**;
- suporte específico a Present mode em mobile não está documentado nas fontes atuais
  e não deve ser presumido.

Não inferir que todo nó precisa entrar. A preparação oficial é uma seleção explícita de elementos.

## Índice oficial atual do Help Centre

A URL `https://support.ayoa.com/mind-maps`, verificada ao vivo em 14/07/2026,
é o índice canônico atual da seção **Mind Maps**. Ela:

- referencia diretamente **Mind Map extra features** (`mind-mapping-tips-and-tricks`),
  onde a descrição viva do Present mode está publicada;
- organiza o conteúdo em: Getting started, Web/Desktop, Radial Maps, Capture Maps,
  iMindMap e Accessibility;
- separa Mind Maps Web/Desktop de **Mind Maps – Mobile**;
- não contém uma página autônoma de Present mode nem menciona diretamente Present;
- confirma, portanto, que o conteúdo atual de Present mode está incorporado à página
  de recursos extras, enquanto o tutorial dedicado antigo foi removido.

Use esse índice para descobrir documentação atual e detectar futuras mudanças na
classificação/URLs. Não o use sozinho para inferir controles ou comportamento.

## Fonte histórica oficial — blog de lançamento

O artigo oficial **“Sharing your ideas is now easier than ever with mind map present!”**,
publicado em 13/10/2020 e atualizado em 07/03/2023, continua acessível e documenta
a interface anterior:

- Present entrava diretamente em fullscreen e revelava branches um a um;
- o botão de apresentação abria a **present window**, onde a apresentação era preparada;
- a ordem podia ser definida antecipadamente;
- o antigo **bookmarks tool** controlava quais branches entravam;
- **Add all** incluía todos os branches;
- drag-and-drop reordenava os itens;
- **Clear all** zerava a apresentação sem apagar branches do mapa;
- Start exigia selecionar o primeiro branch;
- setas do menu ou teclado avançavam/voltavam;
- Stop encerrava fullscreen;
- o recurso já era exclusivo do plano Ultimate.

Essa fonte serve como baseline histórico, não como contrato de seletores atuais. Na UI
8.170.88, bookmarks/Add all foram substituídos por seleção + Add e Auto-create; Start,
Compact, Fullscreen e Dual Screen são controles distintos.

## Terminologia entre versões

- **Present button**: botão da toolbar que abre/fecha a preparação.
- **Present window** (documentação histórica): janela/painel aberto pelo botão.
- **Presenter/Apresentador** (UI atual): nome exibido para a present window.
- **Present mode ativo**: somente após Start, identificado por `.presenting` e pelo
  botão play/stop `.selected`.
- **Start presenting**: na documentação histórica, inicia diretamente a experiência
  em tela cheia; na UI atual, Start ativa `.presenting` e o controle Fullscreen é
  separado (`.slides-fullscreen-button`). Para reproduzir o comportamento oficial
  completo, a automação deve executar Start e depois Fullscreen, validando ambos.
- **Add all** (UI histórica) → **Auto-create** (UI atual): inclusão automática de
  todos os ramos no deck; não confundir com **Add**, que adiciona só a seleção.
- **Clear all** atua somente sobre a lista da apresentação; não é operação destrutiva
  sobre o mapa e nunca deve ser automatizado como exclusão de nós.
- **Stop presenting** (UI histórica e atual): encerra apenas a execução. Na UI atual,
  remove `.presenting` e `.slides-play-stop-button.selected`, preservando a present
  window e a lista de slides para reinício posterior.

Não tratar “present window aberta” como sinônimo de “apresentação em execução”.

## Requisitos de plataforma e plano

- Plano: **Ayoa Ultimate**; se o Present button estiver ausente, verificar primeiro o
  entitlement da conta, não assumir quebra de seletor.
- Plataforma documentada/validada: **Web/Desktop**.
- Mind Maps e Whiteboards: suportados.
- Mobile: a seção oficial é separada, mas não documenta Present mode; tratar como
  indisponível/não suportado até evidência oficial ou teste específico.
- Headless no Termux automatiza a interface Web/Desktop; não equivale ao app móvel.

## Ajuda oficial embutida no aplicativo

O popover `?` do painel **Presenter/Apresentador** informa:

1. selecione um elemento/ramo do quadro;
2. clique em **Add/Adicionar** para transformá-lo em slide individual;
3. reordene os slides;
4. use **Present/Apresentar** para executar a apresentação.

Quando a lista está vazia, a UI oficial oferece:

- **Auto-create**: cria uma apresentação a partir da estrutura do mapa;
- seleção manual + **Add**: cria apenas os slides escolhidos.

O link “Learn more” embutido aponta atualmente para
`https://www.ayoa.com/jump/web-app/mm-presenter-mode`, que retornou HTTP 404 em
2026-07-14. Use o artigo oficial acima como referência pública até o redirect ser
restaurado.

## Anatomia oficial observada na UI

### Preparação

- painel: `.slides-list-container` sem classe `.presenting`;
- lista ordenada: `.slides-list-group-item` (`draggable="true"`);
- reordenar: drag-and-drop dos `.slides-list-group-item`; a nova ordem deve persistir
  e determinar a sequência de navegação;
- adicionar seleção: `.slides-header-add-button button`;
- criar automaticamente quando vazio: `.slides-list-empty button`;
- limpar apresentação: menu `…` → **Clear all**;
- remover slide: `.slides-list-group-options`;
- iniciar: antes do clique, selecionar explicitamente o primeiro
  `.slides-list-group-item`; só então usar `.slides-play-stop-button` sem `.selected`.

A skill deve verificar `activeIndex === 0` antes de Start. A UI atual pode redefinir o
slide ativo assincronamente após Start; por isso, após a ativação, deve confirmar de
novo o primeiro slide ou restaurar deterministicamente o `startAt` solicitado.

### Present mode ativo

- painel: `.slides-list-container.presenting`;
- botão start/stop: `.slides-play-stop-button.selected`;
- slide ativo: `.slides-list-group-item.selected`;
- anterior/próximo: filhos de `.slides-nav-container`;
- tela dupla (Beta): `.slides-popout-button`;
- visualização compacta: `.slides-compact-button`;
- tela cheia: `.slides-fullscreen-button`;
- o modo compacto desmonta a lista de slides do DOM: preserve o deck e o índice
  ativo em cache antes de ativá-lo.

## Atalhos implementados pelo Ayoa Web

Com Present mode ativo e nenhum input/textarea focado:

- anterior: controles da interface em `.slides-nav-container` ou teclado
  `PageUp`, `ArrowUp`, `ArrowLeft`, `Ctrl/Cmd + Espaço`;
- próximo: controles da interface em `.slides-nav-container` ou teclado
  `PageDown`, `ArrowDown`, `ArrowRight`, `Espaço`;
- parar: `Escape`;
- fullscreen: `f`;
- iniciar quando parado: `p`.

A automação deve preferir os controles DOM do painel e usar atalhos como fallback,
pois foco residual em campos de texto faz o Ayoa ignorar as teclas.

## Fluxo canônico da skill

1. Validar cookies e abrir o Mind Map ou Whiteboard.
2. Esperar a SPA montar; não usar espera fixa curta como único sinal.
3. Abrir o Presenter de forma idempotente.
4. Se uma execução anterior ficou em Present mode, parar primeiro.
5. Ler e validar a ordem dos slides.
6. Se vazio, usar Auto-create somente quando solicitado; caso contrário, falhar e
   pedir preparação manual/seleção explícita.
7. Selecionar explicitamente o primeiro slide (`activeIndex === 0`), executar Start e
   confirmar `.presenting`/botão `.selected`; depois revalidar o slide ativo.
8. Para reproduzir o fluxo oficial em tela cheia, acionar separadamente Fullscreen na
   UI atual e confirmar `fullscreen=true`.
9. Navegar via setas da interface (preferencial) ou do teclado (fallback), confirmando
   que Next incrementa e Previous decrementa o `activeIndex` conforme a ordem do deck.
10. Ativar compact separadamente, se solicitado.
11. Executar Stop, confirmar `presenting=false`, remoção do estado `.selected` no
    botão e preservação de `slideCount`/ordem do deck.

## Driver canônico `runFullPresentation`

Caminho canônico quando a tarefa é "executar uma apresentação completa" de um mapa:

1. Verifica disponibilidade: `verifyPlanCompatibility` (toggle-presenter ou
   panel) e `locatePresentControl` por classe, ARIA, texto e tooltip.
2. Abre a present window de forma idempotente.
3. Avalia a apresentação existente: `classifyExistingPresentation` com base em
   `slides.length`, `expectedSlideCount` e `firstItem`:
   - `complete_presentation_available` → preserva o deck e segue.
   - `presentation_empty` / `presentation_partial` / `presentation_invalid` →
     `cleanup_required`: `clearPresentationDeck` (menu `…` → Clear all), recria
     com `requestFullPresentation` (Auto-create).
   - `state_inconclusive` (presenting=true ao abrir) → bloqueia, faz Stop e sai.
4. Seleciona o primeiro item.
5. Inicia e confirma `present_mode_confirmed`.
6. Itera a seta de avanço: a cada clique registra `advancing`,
   `step_change_confirmed` (com `activeIndex + 1` por clique) e `next_control_found`.
7. Detecta o último passo por `hasForwardControl` desabilitado/ausente e
   `activeIndex === slideCount - 1`.
8. Executa Stop, valida `presenting=false` e que o deck não foi reduzido.
9. Emite uma timeline com todos os eventos e a evidência
   `lastVisited`/`stopped`/`openedSlides`/`classification`/`cleared`/`created`.

Estados registrados: `init`, `map_loaded`, `present_control_found`,
`present_window_open`, `presentation_state_checked`,
`complete_presentation_available`, `cleanup_required`, `presentation_cleared`,
`full_presentation_requested`, `generation_in_progress`,
`full_presentation_validated`, `first_item_selected`, `start_control_found`,
`present_mode_confirmed`, `current_step_identified`, `next_control_found`,
`advancing`, `step_change_confirmed`, `last_step_reached`,
`presentation_stopped`, `presentation_completed`, `blocked`.

## Critérios de validação

Uma execução só está válida quando comprova:

- `slideCount > 0`;
- ordem e títulos dos slides lidos;
- `presenting=true` após Start;
- `activeIndex` muda após Next/Previous;
- `compact=true` e/ou `fullscreen=true` quando solicitados;
- `presenting=false` após Stop;
- screenshot real sem toolbars de edição quando compact + fullscreen estão ativos.
