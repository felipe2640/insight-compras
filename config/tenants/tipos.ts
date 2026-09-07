/**
 * Contrato Canônico de Tipagem White-Label Multi-Tenant
 * Camada: Configurações & White-Label (config/tenants/tipos.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { ParametrosMotorCompra } from "@core/calculo/necessidade";

export interface CoresInstitucionaisTenant {
  /** Cor de destaque principal (botões, cabeçalhos, destaques) - ex: #0F2B5C */
  readonly primaria: string;
  /** Cor de destaque secundária (detalhes, badges, acentos) - ex: #D4AF37 */
  readonly secundaria: string;
  /** Cor de acento e pontos focais - ex: #E6C200 */
  readonly acento: string;
  /** Cor de fundo principal da aplicação - ex: #F8FAFC */
  readonly fundo: string;
  /** Cor de fundo para cartões, modais e painéis - ex: #FFFFFF */
  readonly card: string;
  /** Cor da borda padrão de cartões e divisórias - ex: #E2E8F0 */
  readonly borda: string;
  /** Cor principal do texto - ex: #0F172A */
  readonly texto: string;
  /** Cor secundária do texto e rótulos - ex: #475569 */
  readonly textoSecundario: string;
  /** Cor de fundo específica para destaque de itens com múltiplos de fábrica - ex: #FFFFCC */
  readonly fundoDestaqueMultiplo: string;
  /** Variação hover da cor primária - ex: #0A1E40 */
  readonly primariaHover: string;
  /** Variação hover da cor secundária - ex: #B89628 */
  readonly secundariaHover: string;
}

export interface IdentidadeVisualTenant {
  /** Logotipo claro para uso sobre fundos escuros (ex: header azul) */
  readonly logoClaro: string;
  /** Logotipo escuro para uso sobre fundos claros (ex: sidebar branca) */
  readonly logoEscuro: string;
  /** Favicon do navegador */
  readonly favicon: string;
  /** Texto alternativo para acessibilidade (WCAG) */
  readonly altText: string;
  /** Largura recomendada em pixels */
  readonly larguraPadraoPx?: number;
  /** Altura recomendada em pixels */
  readonly alturaPadraoPx?: number;
}

export interface FilialCadastradaTenant {
  readonly filialId: number;
  readonly nome: string;
  readonly codigo: string;
  readonly tipo: "matriz" | "filial";
  readonly ativa: boolean;
  readonly cidade?: string;
  readonly uf?: string;
}

export interface AssinaturaInsightDTenant {
  readonly texto: string; // "Powered by iNSIGHT D"
  readonly url: string; // "https://insightd.com.br"
  readonly exibir: boolean;
  readonly versaoPlataforma: string;
  readonly logoInsightDUrl?: string;
}

/**
 * Procedência da calibração do motor deste cliente.
 * Serve para auditoria: um número que veio de backtest é diferente de um palpite.
 */
export interface ProcedenciaCalibracaoTenant {
  /** Modelo vencedor do backtest, ex.: "current_engine_calibrated_90". */
  readonly modeloVencedor: string;
  /** Data do estudo que produziu o fator (ISO). */
  readonly dataEstudo: string;
  /** Nº de séries produto+loja elegíveis no backtest. */
  readonly seriesElegiveis: number;
  /** Nº de comparações por modelo. */
  readonly comparacoesPorModelo: number;
  /** Cobertura de quantidade no holdout (0..1). */
  readonly coberturaHoldout: number;
  /** Observação livre para o auditor. */
  readonly observacao?: string;
}

/**
 * Parâmetros de motor específicos deste cliente.
 *
 * A LÓGICA do motor é a mesma para todos os tenants (vive em `core/`).
 * O que muda aqui são os VALORES calibrados a partir do processo de venda e
 * compra de cada cliente, aprendidos no backtest do estudo de machine learning.
 */
export interface ParametrosMotorTenant {
  readonly motor: ParametrosMotorCompra;
  /** Lead time padrão do fornecedor, em dias (diagnóstico e ponto de pedido). */
  readonly leadTimePadraoDias: number;
  /** Filial exibida por padrão no cockpit. */
  readonly filialFocoPadraoId: number;
  readonly procedenciaCalibracao: ProcedenciaCalibracaoTenant;
}

export interface ConfiguracaoTenant {
  /** Identificador único do tenant em minúsculas (slug) - ex: "carreiro" */
  readonly id: string;
  /** Nome de exibição institucional do cliente - ex: "Rede Carreiro Autopeças" */
  readonly nome: string;
  /** Razão social legal - ex: "Rede Carreiro de Autopeças e Serviços Ltda" */
  readonly razaoSocial: string;
  /** Subdomínio canônico de produção - ex: "carreiro.insightd.com.br" */
  readonly subdominioPrincipal: string;
  /** Lista de subdomínios ou aliases válidos que resolvem para este tenant */
  readonly subdominiosValidos: readonly string[];
  /** Domínio customizado opcional do cliente - ex: "compras.carreiro.com.br" */
  readonly customDomain?: string;
  /** Paleta de cores institucionais */
  readonly cores: CoresInstitucionaisTenant;
  /** Identidade visual (logos e favicon) */
  readonly identidadeVisual: IdentidadeVisualTenant;
  /** Filiais cadastradas na rede do cliente */
  readonly filiais: readonly FilialCadastradaTenant[];
  /** Assinatura Powered by iNSIGHT D */
  readonly assinatura: AssinaturaInsightDTenant;
  /** Parâmetros calibrados do motor de compra deste cliente. */
  readonly parametrosMotor: ParametrosMotorTenant;
}

/**
 * Converte um valor hexadecimal (#RRGGBB) para componentes numéricos RGB e formato CSS.
 */
export function hexParaRgb(hex: string): { r: number; g: number; b: number; cssRgb: string } {
  const normalizado = hex.replace("#", "").trim();
  const valorHex =
    normalizado.length === 3
      ? normalizado
          .split("")
          .map((c) => c + c)
          .join("")
      : normalizado;

  const num = parseInt(valorHex, 16);
  if (isNaN(num) || valorHex.length !== 6) {
    return { r: 15, g: 43, b: 92, cssRgb: "15, 43, 92" }; // Fallback Azul Carreiro
  }

  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  return { r, g, b, cssRgb: `${r}, ${g}, ${b}` };
}

/**
 * Mapeia a configuração de cores do tenant para um dicionário de CSS Variables.
 */
export function gerarVariaveisCssTenant(tenant: ConfiguracaoTenant): Record<string, string> {
  const rgbPrimaria = hexParaRgb(tenant.cores.primaria).cssRgb;
  const rgbSecundaria = hexParaRgb(tenant.cores.secundaria).cssRgb;

  return {
    "--cor-primaria": tenant.cores.primaria,
    "--cor-primaria-rgb": rgbPrimaria,
    "--cor-primaria-hover": tenant.cores.primariaHover,
    "--cor-secundaria": tenant.cores.secundaria,
    "--cor-secundaria-rgb": rgbSecundaria,
    "--cor-secundaria-hover": tenant.cores.secundariaHover,
    "--cor-acento": tenant.cores.acento,
    "--cor-fundo": tenant.cores.fundo,
    "--cor-card": tenant.cores.card,
    "--cor-borda": tenant.cores.borda,
    "--cor-texto": tenant.cores.texto,
    "--cor-texto-secundario": tenant.cores.textoSecundario,
    "--cor-destaque-multiplo": tenant.cores.fundoDestaqueMultiplo,
  };
}

/**
 * Converte o dicionário de variáveis CSS em uma string para injeção inline no HTML sem FOUC.
 */
export function gerarStringCssVarsInline(tenant: ConfiguracaoTenant): string {
  const vars = gerarVariaveisCssTenant(tenant);
  return Object.entries(vars)
    .map(([chave, valor]) => `${chave}: ${valor};`)
    .join(" ");
}
