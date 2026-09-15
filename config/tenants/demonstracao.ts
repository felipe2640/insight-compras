/**
 * Tenant de DEMONSTRAÇÃO — a identidade da própria plataforma.
 * Camada: Configurações & White-Label (config/tenants/demonstracao.ts).
 *
 * POR QUE ELE EXISTE
 * A plataforma é white-label: cada cliente tem o seu projeto, com os dados e a
 * marca dele. O ambiente público serve para MOSTRAR a plataforma a quem ainda
 * não é cliente, e nele não pode aparecer o nome de nenhuma rede real — nem as
 * lojas, nem as cidades, nem as marcas com que ela trabalha.
 *
 * Este é o tenant padrão: sem nenhuma variável de ambiente configurada, é ele
 * que sobe, com dados sintéticos. Apontar para um cliente é uma decisão
 * explícita (TENANT_ATIVO), nunca o que acontece por descuido.
 *
 * Os parâmetros do motor aqui são os PADRÃO da plataforma, não os de ninguém:
 * o fator de calibração 1,00 quer dizer "sem calibração", porque calibração
 * nasce do histórico de um cliente específico.
 */

import { ConfiguracaoTenant } from "./tipos";

export const TENANT_DEMONSTRACAO: ConfiguracaoTenant = {
  id: "demonstracao",
  nome: "Rede Demonstração",
  razaoSocial: "Rede Demonstração Autopeças Ltda",
  subdominioPrincipal: "demo.insightd.com.br",
  subdominiosValidos: [
    "demo.insightd.com.br",
    "demo.local",
    "demo",
    "demonstracao",
  ],
  // Sintética SEMPRE. O mostruário existe para mostrar a plataforma a quem não
  // é cliente; ele não pode, em hipótese alguma, abrir o estoque de quem é.
  fonteDados: "sintetica",
  cores: {
    primaria: "#1E293B", // Slate 800 — sóbrio, sem remeter a marca de cliente
    primariaHover: "#0F172A",
    secundaria: "#0EA5E9", // Sky 500
    secundariaHover: "#0284C7",
    acento: "#38BDF8",
    fundo: "#F8FAFC",
    card: "#FFFFFF",
    borda: "#E2E8F0",
    texto: "#0F172A",
    textoSecundario: "#475569",
    fundoDestaqueMultiplo: "#FFFFCC",
  },
  identidadeVisual: {
    logoClaro: "/logos/insightd-monochrome.svg",
    logoEscuro: "/logos/insightd-monochrome.svg",
    favicon: "/favicon.ico",
    altText: "Insight Direto — Copiloto de Compras",
    larguraPadraoPx: 160,
    alturaPadraoPx: 42,
  },
  // Lojas genéricas: praça e nome inventados de propósito, para que ninguém
  // reconheça a operação de um cliente numa apresentação.
  filiais: [
    {
      filialId: 1,
      nome: "Loja Matriz",
      codigo: "MATRIZ",
      tipo: "matriz",
      ativa: true,
      cidade: "Centro",
      uf: "SP",
    },
    {
      filialId: 2,
      nome: "Loja Norte",
      codigo: "NORTE",
      tipo: "filial",
      ativa: true,
      cidade: "Zona Norte",
      uf: "SP",
    },
    {
      filialId: 3,
      nome: "Loja Sul",
      codigo: "SUL",
      tipo: "filial",
      ativa: true,
      cidade: "Zona Sul",
      uf: "SP",
    },
    {
      filialId: 4,
      nome: "Loja Leste",
      codigo: "LESTE",
      tipo: "filial",
      ativa: true,
      cidade: "Zona Leste",
      uf: "SP",
    },
    {
      filialId: 5,
      nome: "Loja Oeste",
      codigo: "OESTE",
      tipo: "filial",
      ativa: true,
      cidade: "Zona Oeste",
      uf: "SP",
    },
  ],
  assinatura: {
    texto: "Powered by iNSIGHT D",
    url: "https://insightd.com.br",
    exibir: true,
    versaoPlataforma: "1.0.0",
    logoInsightDUrl: "/logos/insightd-monochrome.svg",
  },

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
      // 1,00 = sem calibração. Calibrar exige o histórico de um cliente real;
      // usar o fator de um cliente aqui seria emprestar o aprendizado dele.
      fatorCalibracao: 1,
      origemPiso: "MEDIANA_LINHA",
      elegibilidade: {
        minimoNotasDistintas: 3,
        minimoMesesAtivos: 2,
      },
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
      usarVocabulario: true,
      multiplosPorSku: {},
    },
    // Sem estudo: os campos numéricos ficam em zero de propósito. Copiar a
    // procedência de um cliente aqui daria ao ambiente de demonstração um
    // lastro que ele não tem.
    procedenciaCalibracao: {
      modeloVencedor: "sem_calibracao",
      dataEstudo: "—",
      seriesElegiveis: 0,
      comparacoesPorModelo: 0,
      coberturaHoldout: 0,
      observacao:
        "Ambiente de demonstração com dados sintéticos. Calibração nasce do histórico de um cliente real; aqui o fator é 1,00.",
    },
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
          "Tudo o que exige decisão, com o diagnóstico que levou a ela.",
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
          "estoque_rede",
          "vendas_30d",
          "vendas_90d",
          "consumo_diario",
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

  processoCompra: {
    habilitado: true,
    tipoERP: "generico",
    etapas: {
      solicitacao: true,
      cotacao: true,
      pedido: true,
      notaEntrada: true,
    },
    tabelasERP: {
      solicitacoes: "solicitacoes_compra",
      solicitacoesEventos: "solicitacoes_eventos",
      cotacoes: "cotacoes",
      cotacoesItens: "cotacoes_itens",
      cotacoesFornecedores: "cotacoes_fornecedores",
      ligacaoPedidoSolicitacao: "pedidos_solicitacoes",
      pedidos: "pedidos",
      notas: "notas",
    },
    statusAprovacaoSolicitacao: {
      A: "Aprovada",
      R: "Recusada",
      P: "Pendente",
    },
    statusCotacao: {
      A: "Aberta",
      F: "Fechada",
    },
    motivosRecusa: [
      {
        codigo: "PRECO_ELEVADO",
        rotulo: "Preço Elevado",
        descricao: "Preço cotado acima do mercado.",
        categoria: "preco",
      },
      {
        codigo: "SEM_ESTOQUE",
        rotulo: "Sem Estoque",
        descricao: "Fornecedor sem estoque no momento.",
        categoria: "disponibilidade",
      },
      {
        codigo: "CANCELADO_CLIENTE",
        rotulo: "Cancelado pelo Cliente",
        descricao: "Cliente desistiu da compra.",
        categoria: "cliente",
      },
    ],
  },
};
