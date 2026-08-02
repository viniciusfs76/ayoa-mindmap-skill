'use strict';
// Build the WAIC deep OPML programmatically. Each leaf is at depth >= 5.
// Source: 10-7-2026 Maço WAIC.docx (Vinicius Silva, MGI).
const fs = require('node:fs');
const path = require('node:path');

const OUT = path.join(process.env.HOME, 'tmp', 'maço-waic-deep.opml');

// Tree: [text, [children]]; leaf = [text].
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function emitNode(out, node, depth) {
  const indent = '  '.repeat(depth);
  if (typeof node === 'string') {
    out.push(`${indent}<outline text="${esc(node)}"/>`);
    return;
  }
  const [text, children] = node;
  out.push(`${indent}<outline text="${esc(text)}">`);
  for (const c of (children || [])) emitNode(out, c, depth + 1);
  out.push(`${indent}</outline>`);
}

const tree = [
  'Mapa de Trabalho - Missao Brasil-China WAIC 16-18 julho 2026',
  [
    ['1 Introducao', [
      ['1.1 Objetivo central da missao', [
        ['1.1.1 Foco diplomatico', [
          ['1.1.1.1 Lideranca da Ministra Esther Dweck', [
            'Ministra de Estado da Gestao e da Inovacao em Servicos Publicos (MGI)',
            'Conduz a delegacao brasileira em Xangai',
          ]],
          ['1.1.1.2 Agenda estrategica', [
            'Reunioes bilaterais de alto nivel',
            'Cerimonia de assinatura do acordo WAICO',
          ]],
        ]],
        ['1.1.2 Processo de negociacao', [
          ['1.1.2.1 Atuacao protagonista do Brasil', [
            'Revisao do texto constitutivo da WAICO',
            'Insercoes brasileiras reconhecidas pelo lado chines',
          ]],
          ['1.1.2.2 Alinhamento com PBIA', [
            'Plano Brasileiro de Inteligencia Artificial',
            'Soberania digital como vetor',
          ]],
        ]],
      ]],
      ['1.2 Lideranca internacional do Brasil em IA', [
        ['1.2.1 Posicionamento politico', [
          ['1.2.1.1 IA centrada no ser humano', [
            'Defesa de valores democraticos',
            'Multilateralismo ativo',
          ]],
          ['1.2.1.2 Defesa do Sul Global', [
            'Reducao de assimetrias tecnologicas',
            'Protagonismo em foros multilaterais',
          ]],
        ]],
        ['1.2.2 Compromissos com a China', [
          ['1.2.2.1 Adesao a WAICO', [
            'Membro fundador desde julho 2026',
            'Aguarda ratificacao do Congresso Nacional',
          ]],
          ['1.2.2.2 Participacao na WAIC 2026', [
            'Cerimonia de abertura dia 17 de julho',
            'Reuniao de Alto Nivel sobre Governanca Global dia 18',
          ]],
        ]],
      ]],
    ]],
    ['2 Delegacao Brasileira', [
      ['2.1 Componentes do MGI', [
        ['2.1.1 Lideranca politica', [
          ['2.1.1.1 Esther Dweck', [
            'Ministra de Estado da Gestao e da Inovacao',
            'Coordenacao geral da missao',
          ]],
          ['2.1.1.2 Miriam Barbuda Chaves', [
            'Assessora Especial da Ministra (MGI)',
            'Suporte direto a chefia da delegacao',
          ]],
        ]],
        ['2.1.2 Coordenacao tecnica', [
          ['2.1.2.1 Guilherme Alberto Almeida de Almeida', [
            'Diretor de Programa da SETE (MGI)',
            'Coordenacao dos temas de governanca',
          ]],
          ['2.1.2.2 Camila Falchetto Romero', [
            'Coordenadora-Geral de Governanca de IA (MGI)',
            'Lideranca tecnica sobre IA',
          ]],
        ]],
      ]],
      ['2.2 Outros orgaos', [
        ['2.2.1 MCTI - Ministerio da Ciencia Tecnologia e Inovacao', [
          ['2.2.1.1 Carlos Matsumoto', [
            'Chefe da Assessoria Especial de Assuntos Internacionais (MCTI)',
            'Coordenacao cientifica bilateral',
          ]],
          ['2.2.1.2 Fernanda Tsunematsu', [
            'Gerente de Projeto (MGI)',
            'Suporte operacional as agendas',
          ]],
        ]],
        ['2.2.2 MRE - Ministerio das Relacoes Exteriores', [
          ['2.2.2.1 Eugenio Vargas Garcia', [
            'Diretor do Departamento de CTI (MRE)',
            'Coordenacao diplomatica multilateral',
          ]],
          ['2.2.2.2 Jhonathan Braga Pereira', [
            'Coordenador-Geral de Comunicacao Digital (MGI)',
            'Suporte em comunicacao publica',
          ]],
        ]],
      ]],
      ['2.3 Presidencia da Republica', [
        ['2.3.1 Assessoria Especial', [
          ['2.3.1.1 Maria Candida Mousinho', [
            'Assessora na AESPR',
            'Articulacao direta com Planalto',
          ]],
        ]],
        ['2.3.2 Delegacao tecnica ampliada', [
          ['2.3.2.1 Organizada pelo MRE', [
            'Inclui tecnicos de ICTs e universidades',
            'Cobertura das agendas WAIC e WAICO',
          ]],
        ]],
      ]],
    ]],
    ['3 Agendas WAIC e WAICO', [
      ['3.1 DIA 1 - Quinta-feira 16 de julho', [
        ['3.1.1 Acessao a WAICO', [
          ['3.1.1.1 Cerimonia de assinatura', [
            ['3.1.1.1.1 Horario 20h local Xangai', [
              'Margem da WAIC 2026',
              'Foto de grupo dos signatarios',
            ]],
            ['3.1.1.1.2 Protocolo', [
              'Palavras do Chanceler Wang Yi',
              'Sem fala prevista para o Brasil',
            ]],
          ]],
          ['3.1.1.2 Pais signatarios confirmados', [
            ['3.1.1.2.1 China sede', [
              'Pais sede do secretariado',
              'Mandato de 3 anos para SG',
            ]],
            ['3.1.1.2.2 Brasil membro fundador', [
              'Sera ratificado pelo Congresso',
              'Aguarda terceiro deposito de ratificacao',
            ]],
          ]],
        ]],
      ]],
      ['3.2 DIA 2 - Sexta-feira 17 de julho', [
        ['3.2.1 Cerimonia de abertura da WAIC 2026', [
          ['3.2.1.1 Horario 10h local', [
            'World Artificial Intelligence Conference 2026',
            'Conferencia principal da China',
          ]],
          ['3.2.1.2 Autoridades pendentes', [
            ['3.2.1.2.1 Nao confirmado', [
              'Qual autoridade chinesa conduzira a abertura',
              'Organizadores ainda em confirmacao',
            ]],
          ]],
        ]],
        ['3.2.2 Marca WAIC e sub-marcas', [
          ['3.2.2.1 WAIC UP', [
            ['3.2.2.1.1 Publicacao inaugural', [
              'Guia de Evolucao da Era IA',
              'Pensamento estrategico',
            ]],
          ]],
          ['3.2.2.2 AI GRAVITY', [
            'Plataforma internacional de dialogo profundo',
            'Colaboracao transfronteirica',
          ]],
          ['3.2.2.3 WAIC Future Tech', [
            'Plataforma de inovacao global',
            'Startups em estagio inicial',
          ]],
          ['3.2.2.4 WAIC CONNECT', [
            'Marca de correspondencia industrial',
            'Cenarios do mundo real',
          ]],
          ['3.2.2.5 WAIC YOUNG', [
            'Marca para jovens',
            'Inovacao da nova geracao',
          ]],
        ]],
      ]],
      ['3.3 DIA 3 - Sabado 18 de julho', [
        ['3.3.1 Reuniao de Alto Nivel sobre Governanca Global', [
          ['3.3.1.1 Horario 9h-12h', [
            ['3.3.1.1.1 Tema Parceria em IA para um futuro mais brilhante', [
              'Quatro topicos principais',
              'Paralelo a WAIC',
            ]],
            ['3.3.1.1.2 Traducao simultanea', [
              'Idiomas arabe chines ingles frances russo espanhol',
              '6 canais paralelos',
            ]],
          ]],
        ]],
        ['3.3.2 Programa detalhado', [
          ['3.3.2.1 Sessao da manha', [
            ['3.3.2.1.1 9h-9h15 abertura', [
              'Palavras dos anfitrioes',
              'Boas-vindas oficiais',
            ]],
            ['3.3.2.1.2 9h15-10h30 intervencoes', [
              'Chefes de delegacao 3 minutos cada',
              'Sequencia predeterminada',
            ]],
            ['3.3.2.1.3 10h30-10h45 parada para cha', [
              'Networking informal',
              'Traducao pausada',
            ]],
            ['3.3.2.1.4 10h45-11h55 mais intervencoes', [
              'Continuacao das falas',
              'Chefes de delegacao restantes',
            ]],
            ['3.3.2.1.5 11h55-12h00 encerramento', [
              'Palavras finais',
              'Foto oficial',
            ]],
          ]],
        ]],
      ]],
    ]],
    ['4 Informacoes locais sobre a China', [
      ['4.1 Idioma e comunicacao', [
        ['4.1.1 Mandarim como idioma oficial', [
          ['4.1.1.1 Ingles em hoteis de luxo', [
            'Comunicacao razoavel em cadeias globais',
            'Funcionarios geralmente falam ingles basico',
          ]],
          ['4.1.1.2 Tradutores profissionais', [
            'Recomendado em reunioes formais',
            'Suplementa a comunicacao basica',
          ]],
        ]],
      ]],
      ['4.2 Clima e estacao', [
        ['4.2.1 Verao chines (maio a outubro)', [
          ['4.2.1.1 Temperatura alta e umidade elevada', [
            'Vestuario leve recomendado',
            'Hidratacao constante',
          ]],
        ]],
        ['4.2.2 Clima em Xangai julho 2026', [
          ['4.2.2.1 Previsao AccuWeather', [
            'Media entre 25 e 32 graus Celsius',
            'Umidade relativa alta 75 por cento',
          ]],
        ]],
      ]],
      ['4.3 Fuso horario e eletricidade', [
        ['4.3.1 GMT+8 China contra GMT-3 Brasil', [
          ['4.3.1.1 Diferenca de fuso', [
            'Diferenca de 11 horas entre Brasilia e Xangai',
            'Brasilia 8h atras em relacao a Xangai',
          ]],
        ]],
        ['4.3.2 Voltagem 220V China', [
          ['4.3.2.1 Tomadas compativeis com Brasil', [
            'Sistema de 3 pinos brasileiro incompativel',
            'Adaptadores universais recomendados',
          ]],
        ]],
      ]],
      ['4.4 Pagamentos e bancos', [
        ['4.4.1 Aplicativos chineses de pagamento', [
          ['4.4.1.1 Alipay', [
            'Aceita cartao de credito internacional',
            'Predominante em todo o pais',
          ]],
          ['4.4.1.2 WeChat Pay', [
            'QR code universal',
            'Cadastro de cartao internacional',
          ]],
        ]],
        ['4.4.2 ATMs internacionais', [
          ['4.4.2.1 Disponibilidade ampla', [
            'Cartoes de bandeira internacional aceitos',
            'Terminais em hoteis e areas centrais',
          ]],
        ]],
      ]],
      ['4.5 Transporte urbano em Xangai', [
        ['4.5.1 Taxi na rua', [
          ['4.5.1.1 Pratica em declinio', [
            'Digitalizacao da economia',
            'Recomendacao de apps',
          ]],
        ]],
        ['4.5.2 Didi Chuxing Uber da China', [
          ['4.5.2.1 Cobertura e idioma', [
            'Versao em ingles disponivel',
            'Substituto funcional do Uber',
          ]],
        ]],
        ['4.5.3 Metro de Xangai', [
          ['4.5.3.1 Operacao e bilheteria', [
            'Horario 5h-22h30',
            'Bilhete em distribuidor automatico',
            'Cobertura ampla da cidade',
          ]],
        ]],
      ]],
      ['4.6 Internet e VPN', [
        ['4.6.1 Servicos bloqueados', [
          ['4.6.1.1 Categorias de bloqueio', [
            'Google Facebook WhatsApp nao funcionam',
            'Necessario VPN para acessar',
          ]],
        ]],
        ['4.6.2 Apps que funcionam', [
          ['4.6.2.1 Skype Teams FaceTime via Apple', [
            'Funcionam por excecao de regras chinesas',
            'Varia por provedor de internet',
          ]],
        ]],
      ]],
      ['4.7 Aplicativos uteis na China', [
        ['4.7.1 WeChat mensagens e pagamentos', [
          ['4.7.1.1 WeChat Pay', [
            'QR code universal em todas as atividades',
            'Necessario para pagamentos',
          ]],
          ['4.7.1.2 GPS integrado', [
            'Conexao com mapas instalados',
            'Funcionalidade nativa',
          ]],
          ['4.7.1.3 Canais de noticias', [
            'Em chines com traducao interna',
            'Para acompanhar midia local',
          ]],
        ]],
        ['4.7.2 Baidu Translate', [
          ['4.7.2.1 Cobertura', [
            'Substituto do Google Translate',
            'Funciona sem VPN',
          ]],
        ]],
        ['4.7.3 JSS entregas', [
          ['4.7.3.1 Delivery de comida e higiene', [
            'App tipo iFood',
            'Cobertura em cidades grandes',
          ]],
        ]],
        ['4.7.4 Dianping guia turistico', [
          ['4.7.4.1 Restaurantes e atracoes', [
            'Reviews locais',
            'Recomendacoes por geolocalizacao',
          ]],
        ]],
      ]],
      ['4.8 Protocolos sanitarios', [
        ['4.8.1 Vacina de Febre Amarela', [
          ['4.8.1.1 China exige comprovante internacional', [
            'Conforme normas da ANVISA',
            'Vacinacao obrigatoria para entrada',
          ]],
        ]],
        ['4.8.2 Telefones de emergencia', [
          ['4.8.2.1 Numeros uteis na China', [
            'Policia 110',
            'Policia rodoviaria 122',
            'Bombeiros 119',
            'Ambulancia 120',
            'Prefixo do pais +86',
          ]],
          ['4.8.2.2 Hospitais publicos', [
            'Cobram atendimento mesmo de emergencia',
            'Pagamento em dinheiro ou Alipay',
          ]],
        ]],
        ['4.8.3 Farmacia e medicamentos', [
          ['4.8.3.1 Prescricao medica controlada', [
            'Embaixada ou Consulado orientam',
            'Documentacao internacional necessaria',
          ]],
        ]],
      ]],
      ['4.9 Visto de entrada na China', [
        ['4.9.1 Isencao para passaporte oficial brasileiro', [
          ['4.9.1.1 Acordo bilateral Brasil-China', [
            'Diplomaticos e oficiais isentos',
            'Estadia sem limite formal',
          ]],
        ]],
        ['4.9.2 Visto de turismo simplificado', [
          ['4.9.2.1 Periodo 1 jun 2025 ate 31 dez 2026', [
            'Portadores de passaporte comum',
            'Visto na chegada',
          ]],
          ['4.9.2.2 Casos com exigencia de visto previo', [
            'Cidadaos fora do escopo simplificado',
            'Embaixada do Brasil em Pequim para orientacao',
          ]],
        ]],
      ]],
      ['4.10 Vocabulario basico de mandarim', [
        ['4.10.1 Saudoes e cortesia', [
          ['4.10.1.1 Obrigado', [
            'Xie xie',
            'Expressao universal de gratidao',
          ]],
          ['4.10.1.2 Bom dia Boa tarde Boa noite', [
            'Zao shang hao Xia wu hao Wan shang hao',
            'Saudacao de acordo com o periodo do dia',
          ]],
          ['4.10.1.3 Por favor De nada', [
            'Qing Bu ke qi',
            'Pedidos e respostas educadas',
          ]],
        ]],
        ['4.10.2 Desculpas e abordagem', [
          ['4.10.2.1 Desculpe geral', [
            'Dui bu qi',
            'Pedido de desculpas padrao',
          ]],
          ['4.10.2.2 Desculpe para perguntar', [
            'Qing wen',
            'Educacao ao abordar alguem',
          ]],
          ['4.10.2.3 Ola e ate logo', [
            'Ni hao Zai jian',
            'Cumprimento e despedida',
          ]],
        ]],
      ]],
    ]],
    ['5 Subsidios para as atividades', [
      ['5.1 Sobre a WAICO', [
        ['5.1.1 Criacao da organizacao', [
          ['5.1.1.1 Proposta chinesa de 2025', [
            ['5.1.1.1.1 Sede em Xangai', [
              'Capital financeira da China',
              'Hub de IA com Alibaba e Tencent',
            ]],
            ['5.1.1.1.2 Promocao da IA beneficiosa', [
              'Visa global compartilhada',
              'Foco em civilizacao equitativa',
            ]],
          ]],
          ['5.1.1.2 Estrutura institucional', [
            ['5.1.1.2.1 Conselho superior', [
              'Orgao decisorio supremo',
              'Integrado por Estados Membros',
            ]],
            ['5.1.1.2.2 Processo decisorio', [
              'Consenso prioritario',
              'Votacao por maioria 2 tercos qualificada',
            ]],
            ['5.1.1.2.3 Beneficiario do Brasil', [
              'Setor produtivo nacional',
              'Profissionais de CTI',
              'Alinhamento com Plano Brasileiro de IA',
            ]],
          ]],
        ]],
        ['5.1.2 Financiamento da organizacao', [
          ['5.1.2.1 Contribuicoes dos Membros', [
            ['5.1.2.1.1 Cota brasileira estimada', [
              '10 cotas UPU',
              'Equivalente a 2 milhoes USD por ano',
            ]],
            ['5.1.2.1.2 Apos ratificacao do Congresso', [
              'Entrada em vigor apos 3 instrumentos depositados',
              'Membros fundadores anunciados na cerimonia',
            ]],
          ]],
        ]],
      ]],
      ['5.2 Contribuicoes brasileiras ao texto', [
        ['5.2.1 Negociacao do acordo constitutivo', [
          ['5.2.1.1 Instrucao presidencial Lula', [
            ['5.2.1.1.1 Engajamento MCTI + MRE + Presidencia', [
              'Coordenacao tripartite',
              'Acompanhamento diario',
            ]],
            ['5.2.1.1.2 Sugestoes acatadas', [
              'Mencao a ONU e UNESCO',
              'Acolhimento majoritario das proposicoes',
            ]],
          ]],
        ]],
        ['5.2.2 Insercoes tecnicas brasileiras', [
          ['5.2.2.1 Topicos defendidos', [
            ['5.2.2.1.1 Promocao de interoperabilidade', [
              'Padroes abertos em acoes praticas',
              'Reduzir barreiras de entrada',
            ]],
            ['5.2.2.1.2 Contra participacao de ONGs e privadas', [
              'Decisao politica de soberania',
              'Mantem o controle estatal',
            ]],
            ['5.2.2.1.3 Excluir transferencia de tecnologia forcada', [
              'Termo nao incluido no texto final',
              'Salvaguarda para a soberania brasileira',
            ]],
          ]],
        ]],
        ['5.2.3 Cenario da ceremonia de assinatura', [
          ['5.2.3.1 Data e local', [
            '16 de julho de 2026 20h local',
            'Xangai China na margem da WAIC 2026',
          ]],
          ['5.2.3.2 Pais presentes na negociacao', [
            ['5.2.3.2.1 China Brasil Quirquistao Russia', [
              'Bloco de pais fundadores confirmados',
              'Negociacoes desde 2025',
            ]],
            ['5.2.3.2.2 Belarus Uzbequistao Zambia Quenia', [
              'Outros signatarios da negociacao',
              'Presenca confirmada na assinatura',
            ]],
          ]],
          ['5.2.3.3 Protocolo da cerimonia', [
            'Palavras do Chanceler Wang Yi',
            'Assinatura formal do acordo',
            'Foto de grupo dos signatarios',
          ]],
        ]],
      ]],
    ]],
  ],
];

const out = [
  '<?xml version="1.0" encoding="UTF-8"?>',
  '<opml version="2.0">',
  '  <head>',
  '    <title>Mapa WAIC - Mao de Trabalho da Missao Brasil-China (deep)</title>',
  '    <dateCreated>Thu, 16 Jul 2026 18:30:00 -0300</dateCreated>',
  '    <ownerName>Vinicius Silva</ownerName>',
  '  </head>',
  '  <body>',
];
emitNode(out, tree, 2);
out.push('  </body>');
out.push('</opml>');
fs.writeFileSync(OUT, out.join('\n') + '\n');

// Validate: every leaf at depth >= 5
let depth = 0;
let leaves = 0, shallow = 0;
function walk(n, d) {
  if (typeof n === 'string') {
    if (d < 5) shallow++;
    leaves++;
    return;
  }
  const [t, ch] = n;
  for (const c of (ch || [])) walk(c, d + 1);
}
walk(tree, 0);
console.log(`leaves: ${leaves}, shallow (<5): ${shallow}`);
console.log('wrote:', OUT);
