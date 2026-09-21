/**
 * Configuração White-Label Oficial: Rede Carreiro Autopeças
 * Camada: Configurações & White-Label (config/tenants/carreiro.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { ConfiguracaoTenant } from "./tipos";

export const TENANT_CARREIRO: ConfiguracaoTenant = {
  id: "carreiro",
  nome: "Rede Carreiro Autopeças",
  razaoSocial: "Rede Carreiro de Autopeças e Serviços Ltda",
  subdominioPrincipal: "carreiro.insightdireto.com.br",
  subdominiosValidos: [
    "carreiro.insightdireto.com.br",
    // Alias legado: mantido enquanto houver host apontado para o domínio antigo.
    "carreiro.insightd.com.br",
    "carreiro.insight-compras.com.br",
    "carreiro.local",
    "carreiro",
  ],
  customDomain: "compras.carreiro.com.br",
  fonte: {
    adaptador: "powerbi-dax",
    nomeERP: "ConnectSoft ShopCash",
  },
  /**
   * Paleta tirada do LOGOTIPO da rede, não inventada.
   *
   * O que havia aqui era um azul-marinho escuro com dourado — e dourado não
   * existe na marca: o logo é um azul forte com a marca em branco. Quem visse
   * a plataforma ao lado da fachada não reconheceria a mesma empresa.
   *
   * A secundária é o mesmo azul, dois passos mais claro, para detalhes e
   * bordas sobre o azul cheio; o branco do logo entra como acento.
   */
  cores: {
    primaria: "#0B39B0", // Azul Carreiro, lido do logotipo
    primariaHover: "#082B87", // Azul aprofundado para hover
    secundaria: "#3B6BE0", // Azul claro de detalhe (bordas, badges)
    secundariaHover: "#2B55C0", // Azul de detalhe em hover
    acento: "#FFFFFF", // Branco do logotipo
    fundo: "#F8FAFC", // Slate 50 (Fundo Clean)
    card: "#FFFFFF", // Fundo Branco Puro de Cartões
    borda: "#E2E8F0", // Slate 200 (Borda Suave)
    texto: "#0F172A", // Slate 900 (Contraste Elevado)
    textoSecundario: "#475569", // Slate 600
    fundoDestaqueMultiplo: "#FFFFCC", // Amarelo Pastel do Cockpit de Múltiplos
  },
  identidadeVisual: {
    logoClaro: "/tenants/carreiro/logo-carreiro.png",
    logoEscuro: "/tenants/carreiro/logo-carreiro.png",
    favicon: "/tenants/carreiro/logo-carreiro.png",
    altText: "Logotipo da Rede Carreiro Autopeças",
    larguraPadraoPx: 160,
    alturaPadraoPx: 42,
  },
  filiais: [
    {
      filialId: 1,
      nome: "Carreiro Pedro II (Matriz)",
      codigo: "MATRIZ",
      tipo: "matriz",
      ativa: true,
      cidade: "Pedro II",
      uf: "PI",
      nomeFonte: "CARREIRO PEDRO II",
      identificadoresFonte: ["1|e2adc241-50f7-4dcd-9527-423080cd8c5c"],
    },
    {
      filialId: 2,
      nome: "Melo / Piripiri",
      codigo: "PIRIPIRI",
      tipo: "filial",
      ativa: true,
      cidade: "Piripiri",
      uf: "PI",
      nomeFonte: "MELO DISTRIBUIDORA",
      identificadoresFonte: ["1|cd87703f-0d8c-447e-9bdf-5c1d790f587b"],
    },
    {
      filialId: 3,
      nome: "Carreiro Poranga",
      codigo: "PORANGA",
      tipo: "filial",
      ativa: true,
      cidade: "Poranga",
      uf: "CE",
      nomeFonte: "CARREIRO PORANGA",
      identificadoresFonte: ["1|a5172ddc-0dd0-4f8e-bb0d-5018183d4457"],
    },
    {
      filialId: 4,
      nome: "Ceará Auto Peças (Campo Maior)",
      codigo: "CAMPO_MAIOR",
      tipo: "filial",
      ativa: true,
      cidade: "Campo Maior",
      uf: "PI",
      nomeFonte: "CEARA AUTO PECAS CAMPO MAIOR",
      identificadoresFonte: ["1|c9432abf-af64-40d2-abe3-21124f49b2ae"],
    },
    {
      filialId: 5,
      nome: "Carreiro José de Freitas",
      codigo: "JOSE_FREITAS",
      tipo: "filial",
      ativa: true,
      cidade: "José de Freitas",
      uf: "PI",
      nomeFonte: "CARREIRO JOSE DE FREITAS",
      identificadoresFonte: ["1|d624d502-59a4-4ab2-910b-99ae9bf7462a"],
    },
  ],
  assinatura: {
    texto: "Powered by Insight Direto",
    url: "https://insightdireto.com.br",
    exibir: true,
    versaoPlataforma: "1.0.0",
    logoInsightDUrl: "/logos/insightd-monochrome.svg",
  },

  /**
   * CALIBRAÇÃO HOMOLOGADA DA REDE CARREIRO.
   *
   * Os horizontes e margens são os mesmos da plataforma (base comum). O que é
   * exclusivo deste cliente é o `fatorCalibracao`, vencedor do backtest de 15
   * cortes entre jul/2025 e jul/2026 sobre as 5 lojas da rede.
   *
   * Regra de seleção (idêntica para todo cliente, em core): entre os modelos que
   * perdem no máximo 2 p.p. de cobertura contra o baseline, vence o de menor WAPE.
   * Aqui o vencedor foi `current_engine_calibrated_90` — cobertura 0,728 no
   * holdout contra 0,741 do baseline, com 42.047 unidades de excesso evitadas
   * contra 43.153 do baseline.
   *
   * Para recalibrar: rodar o pipeline do estudo e atualizar fator + procedência.
   */
  parametrosMotor: {
    motor: {
      horizontes: {
        ALTO_GIRO: 20,
        MEDIO_GIRO: 15,
        BAIXO_GIRO_INTERMITENTE: 7,
        SEM_HISTORICO_SUFICIENTE: 0,
      },
      margens: {
        ALTO_GIRO: 0.25,
        MEDIO_GIRO: 0.45,
        BAIXO_GIRO_INTERMITENTE: 0.8,
        SEM_HISTORICO_SUFICIENTE: 0,
      },
      fatorCalibracao: 0.9,
      origemPiso: "MEDIANA_LINHA",
      elegibilidade: {
        minimoNotasDistintas: 3,
        minimoMesesAtivos: 2,
      },
      /**
       * "REDUZIR COMPRAS" da medida `Decisao Compra Mercadoria` não diz quanto
       * reduzir. O corte é proporcional ao quanto a margem que o item ENTREGOU
       * nos 12 meses fechados ficou abaixo da margem com que ele foi PRECIFICADO.
       *
       * margemAlvoRede = null: a Carreiro NÃO usa meta única. Medido ao vivo em
       * Pedro II, a margem pretendida por item vai de 35,3% (p10) a 53,9% (p90),
       * mediana 42,1% — contra uma meta fixa de 30% quase todo item pareceria
       * saudável e o corte jamais dispararia. O alvo vem do cadastro de cada item.
       *
       * pisoFator 0,25: mesmo um item vendendo no prejuízo mantém 1/4 da reposição
       * quando há demanda comprovada. Zerar é papel exclusivo do PAUSAR.
       *
       * fatorSemMargem 0,50: aplica-se aos ~3% de itens com demanda cujo custo não
       * está lançado. Nesses o corte é declarado, não calculado.
       */
      reducaoGovernanca: {
        margemAlvoRede: null,
        pisoFator: 0.25,
        fatorSemMargem: 0.5,
      },
    },
    leadTimePadraoDias: 7,
    filialFocoPadraoId: 1,
    lotes: {
      usarErp: true,
      usarHistorico: true,
      // Evita afirmar que vende em par apenas pelo nome da peça.
      usarVocabulario: false,
      multiplosPorSku: {},
    },
    procedenciaCalibracao: {
      modeloVencedor: "current_engine_calibrated_90",
      dataEstudo: "2026-09-07",
      seriesElegiveis: 8998,
      comparacoesPorModelo: 69900,
      coberturaHoldout: 0.728,
      observacao:
        "15 cortes (jul/2025 a jul/2026); os 5 cortes finais ficaram fora da escolha " +
        "e serviram como confirmação cega. 86,1% das comparações não tiveram venda " +
        "no período seguinte, o que reforça a preferência por cobertura sobre WAPE puro.",
    },
  },

  /**
   * EXPORTAÇÃO — layouts da Rede Carreiro.
   *
   * CSV com ";" e vírgula decimal, com BOM: é o que o Excel em português e o
   * ERP da rede leem sem retrabalho. Se o ERP passar a exigir outro nome de
   * coluna (ex.: "COD_PROD"), é só preencher `rotulosPersonalizados` — nada de
   * código muda.
   */
  /**
   * O que o cadastro do ERP guarda como produto mas não é mercadoria.
   *
   * A rede fatura mão de obra pela MESMA tabela PRODUTOS das peças, em nota de
   * venda tipo 01 — para qualquer agregação, um balanceamento é igual a uma
   * pastilha de freio. Como serviço nunca tem estoque e tem venda recorrente, o
   * motor o lia como o item mais urgente do catálogo e mandava comprar 26
   * unidades de "SERVICO BALANCEAMENTO".
   *
   * LEVANTAMENTO AO VIVO NO MODELO DO CLIENTE (15/09/2026):
   * - 265 linhas na classe 1107 (53 SKUs x 5 lojas), e 100% delas são serviço:
   *   não há um único item dessa classe com marca fora do padrão de serviço;
   * - 51 serviços com venda nos últimos 180 dias, todos na Melo Distribuidora.
   *   O balanceamento lidera com 192 unidades e 72 notas em 12 meses;
   * - só 1 SKU de serviço fica fora da classe: 029455 "SERVICO TESTE 1000",
   *   com classe nula e nenhuma venda — não gera sugestão e não vale uma regra.
   *
   * A regra é por CÓDIGO e não por texto de propósito: "REGENCE VEICULOS PECAS E
   * SERVI" (classe 915), "PREMIUM CAR SERVICE" (314) e "I9 COMERCIO E SERVICOS
   * EIRELI" (827) também têm "SERVI" no nome e são fornecedores de peça de verdade.
   */
  catalogo: {
    classesNaoCompraveis: [
      {
        codigoBase: 1107,
        nome: "SERVICOS MECANICOS",
        motivo:
          "Mão de obra faturada pela tabela de produtos. Não tem estoque, não tem fornecedor e não se compra.",
      },
    ],
  },
  exportacao: {
    layoutPadraoId: "pedido_fornecedor",
    formatoPadrao: "csv",
    csvPadrao: {
      separador: ";",
      separadorDecimal: ",",
      incluirBom: true,
      quebraLinha: "\r\n",
    },
    layouts: [
      {
        id: "pedido_fornecedor",
        nome: "Pedido ao fornecedor",
        descricao:
          "Itens com quantidade de compra, prontos para enviar ao fornecedor.",
        escopo: "compra",
        formatosPermitidos: ["csv", "xlsx", "pdf"],
        colunas: [
          "sku",
          "descricao",
          "marca",
          "sub_grupo",
          "ref_fabricante",
          "loja",
          "estoque_loja",
          "consumo_diario",
          "qtd_sugerida",
          "qtd_pedido",
          "lote_multiplo",
          "preco_custo",
          "valor_total_pedido",
          "motivo",
        ],
        nomeArquivo: "pedido_{tenant}_{loja}_{data}",
        tituloPdf: "Pedido de Compra ao Fornecedor",
      },
      {
        id: "transferencias_lojas",
        nome: "Transferências entre lojas",
        descricao:
          "O que sai de qual loja para qual, mantendo a demanda da origem.",
        escopo: "transferencia",
        formatosPermitidos: ["csv", "xlsx", "pdf"],
        colunas: [
          "sku",
          "descricao",
          "marca",
          "sub_grupo",
          "loja_origem",
          "loja",
          "qtd_transferir",
          "saldo_origem",
          "origem_mantem",
          "sobra_origem",
          "estoque_loja",
          "consumo_diario",
          "motivo",
        ],
        nomeArquivo: "transferencias_{tenant}_{loja}_{data}",
        tituloPdf: "Transferências entre Lojas",
      },
      {
        id: "analise_completa",
        nome: "Análise completa (compra + transferência)",
        descricao:
          "Toda ação sugerida com o diagnóstico que a justifica. Só planilha.",
        escopo: "compra_ou_transferencia",
        formatosPermitidos: ["csv", "xlsx"],
        colunas: [
          "sku",
          "descricao",
          "marca",
          "sub_grupo",
          "curva_abc",
          "perfil_giro",
          "loja",
          "estoque_loja",
          "estoque_minimo",
          "estoque_rede",
          "vendas_30d",
          "vendas_90d",
          "vendas_180d",
          "consumo_diario",
          "cobertura_90d",
          "notas_90d",
          "frequencia",
          "qtd_sugerida",
          "qtd_pedido",
          "qtd_transferir",
          "loja_origem",
          "preco_custo",
          "valor_total_pedido",
          "status",
          "motivo",
        ],
        nomeArquivo: "analise_{tenant}_{loja}_{data}",
      },
    ],
  },
  curvaAbc: {
    metodo: "GIRO",
    fallbackParaGiroSeErpInvalido: true,
  },
};
