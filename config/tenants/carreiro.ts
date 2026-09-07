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
};
