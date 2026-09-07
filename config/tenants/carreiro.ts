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
  subdominioPrincipal: "carreiro.insightd.com.br",
  subdominiosValidos: [
    "carreiro.insightd.com.br",
    "carreiro.insight-compras.com.br",
    "carreiro.local",
    "carreiro",
  ],
  customDomain: "compras.carreiro.com.br",
  cores: {
    primaria: "#0F2B5C", // Azul Carreiro Institucional
    primariaHover: "#0A1E40", // Azul Escurecido para Hover
    secundaria: "#D4AF37", // Dourado Carreiro Nobre
    secundariaHover: "#B89628", // Dourado Escurecido para Hover
    acento: "#E6C200", // Amarelo Ouro de Acento
    fundo: "#F8FAFC", // Slate 50 (Fundo Clean)
    card: "#FFFFFF", // Fundo Branco Puro de Cartões
    borda: "#E2E8F0", // Slate 200 (Borda Suave)
    texto: "#0F172A", // Slate 900 (Contraste Elevado)
    textoSecundario: "#475569", // Slate 600
    fundoDestaqueMultiplo: "#FFFFCC", // Amarelo Pastel do Cockpit de Múltiplos
  },
  identidadeVisual: {
    logoClaro: "/tenants/carreiro/logo-carreiro-claro.svg",
    logoEscuro: "/tenants/carreiro/logo-carreiro-escuro.svg",
    favicon: "/tenants/carreiro/favicon.ico",
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
    },
    {
      filialId: 2,
      nome: "Melo / Piripiri",
      codigo: "PIRIPIRI",
      tipo: "filial",
      ativa: true,
      cidade: "Piripiri",
      uf: "PI",
    },
    {
      filialId: 3,
      nome: "Carreiro Poranga",
      codigo: "PORANGA",
      tipo: "filial",
      ativa: true,
      cidade: "Poranga",
      uf: "CE",
    },
    {
      filialId: 4,
      nome: "Ceará Auto Peças (Campo Maior)",
      codigo: "CAMPO_MAIOR",
      tipo: "filial",
      ativa: true,
      cidade: "Campo Maior",
      uf: "PI",
    },
    {
      filialId: 5,
      nome: "Carreiro José de Freitas",
      codigo: "JOSE_FREITAS",
      tipo: "filial",
      ativa: true,
      cidade: "José de Freitas",
      uf: "PI",
    },
  ],
  assinatura: {
    texto: "Powered by iNSIGHT D",
    url: "https://insightd.com.br",
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
    },
    leadTimePadraoDias: 7,
    filialFocoPadraoId: 1,
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
};
