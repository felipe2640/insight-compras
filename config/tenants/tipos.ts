/**
 * Contrato Canônico de Tipagem White-Label Multi-Tenant
 * Camada: Configurações & White-Label (config/tenants/tipos.ts)
 * 100% em Português do Brasil (pt-BR).
 */

import { ParametrosMotorCompra } from "@core/calculo/necessidade";
import { ConfiguracaoExportacaoTenant } from "@/lib/exportacao/tipos";

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
  readonly texto: string; // "Powered by Insight Direto"
  readonly url: string; // "https://insightdireto.com.br"
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
  /** Fontes aceitas e exceções explícitas para múltiplos de compra. */
  readonly lotes: ConfiguracaoLotesTenant;
  readonly procedenciaCalibracao: ProcedenciaCalibracaoTenant;
}

export interface ConfiguracaoLotesTenant {
  readonly usarErp: boolean;
  readonly usarHistorico: boolean;
  readonly usarVocabulario: boolean;
  /** Exceções auditáveis por código do SKU. Ex.: { "030666": 1 }. */
  readonly multiplosPorSku: Readonly<Record<string, number>>;
}

/**
 * Classe/grupo do ERP que NÃO é mercadoria comprável.
 *
 * O cadastro de produtos do ERP não guarda só peça. A Rede Carreiro fatura mão
 * de obra (balanceamento, troca de amortecedor) pela mesma tabela PRODUTOS, em
 * nota de venda tipo 01 — indistinguível de uma peça para qualquer agregação.
 *
 * Para o motor de compra isso é veneno silencioso: serviço tem demanda
 * recorrente comprovada e saldo físico eternamente zero, que é exatamente o
 * perfil do item que ele mais quer comprar. Medido ao vivo em 15/09/2026, o
 * cockpit sugeria comprar 26 unidades de "SERVICO BALANCEAMENTO".
 *
 * A exclusão é por CÓDIGO declarado, nunca por texto da descrição ou da marca:
 * o mesmo cadastro tem "REGENCE VEICULOS PECAS E SERVI" e "PREMIUM CAR SERVICE"
 * como classes, e são fornecedores de peça de verdade.
 */
export interface ClasseNaoCompravelTenant {
  /**
   * Código BASE da classe no ERP, sem o prefixo de empresa.
   *
   * O ERP da Carreiro prefixa a classe com a loja: a classe 1107 chega como
   * 1000000001107 na loja 1 e 5000000001107 na loja 5. Declare 1107.
   */
  readonly codigoBase: number;
  /** Nome da classe como está no ERP, para auditoria. Ex.: "SERVICOS MECANICOS". */
  readonly nome: string;
  /** Por que não é comprável. Fica no histórico da decisão. */
  readonly motivo: string;
}

/**
 * O que, no cadastro de produtos do cliente, não deve virar item de compra.
 *
 * A lista é de declaração OBRIGATÓRIA, mesmo vazia: um cliente sem serviços no
 * cadastro é uma AFIRMAÇÃO conferida, diferente de ninguém ter olhado.
 */
export interface ConfiguracaoCatalogoTenant {
  readonly classesNaoCompraveis: readonly ClasseNaoCompravelTenant[];
}

export interface ConfiguracaoTenant {
  /** Identificador único do tenant em minúsculas (slug) - ex: "carreiro" */
  readonly id: string;
  /** Nome de exibição institucional do cliente - ex: "Rede Carreiro Autopeças" */
  readonly nome: string;
  /** Razão social legal - ex: "Rede Carreiro de Autopeças e Serviços Ltda" */
  readonly razaoSocial: string;
  /** Subdomínio canônico de produção - ex: "carreiro.insightdireto.com.br" */
  readonly subdominioPrincipal: string;
  /** Lista de subdomínios ou aliases válidos que resolvem para este tenant */
  readonly subdominiosValidos: readonly string[];
  /** Domínio customizado opcional do cliente - ex: "compras.carreiro.com.br" */
  readonly customDomain?: string;
  /**
   * De onde vêm os dados de estoque e venda DESTE cliente.
   *
   * A fábrica de adaptadores escolhia sozinha: havendo credenciais de Power BI
   * no ambiente, ela devolvia o adaptador da Carreiro — com os GUIDs e os nomes
   * CADEMP da rede dela — fosse qual fosse o tenant. Duas consequências: o
   * ambiente de DEMONSTRAÇÃO servia dados reais de cliente sob nomes
   * sintéticos, e o segundo cliente herdaria o mapeamento do primeiro.
   *
   * "sintetica" nunca toca a nuvem de ninguém.
   */
  readonly fonteDados: "powerbi-carreiro" | "sintetica";
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
  /** O que o cadastro do ERP guarda como produto mas não é mercadoria comprável. */
  readonly catalogo: ConfiguracaoCatalogoTenant;
  /**
   * Layouts de exportação (CSV/XLSX/PDF) deste cliente.
   * O ERP e os fornecedores de cada cliente exigem colunas, rótulos e
   * separadores próprios; o motor de exportação é comum, o layout é daqui.
   */
  readonly exportacao: ConfiguracaoExportacaoTenant;
  /**
   * Configuração do fluxo e ciclo de compras do ERP do cliente.
   * Rastreia: Solicitação de Balcão -> Cotação -> Pedido de Compra -> Entrada NF.
   */
  readonly processoCompra?: ConfiguracaoProcessoCompraTenant;
}

/** Motivo de recusa cadastrado ou selecionável para solicitações de compra */
export interface MotivoRecusaCompraTenant {
  readonly codigo: string;
  readonly rotulo: string;
  readonly descricao: string;
  readonly categoria:
    | "preco"
    | "disponibilidade"
    | "operacional"
    | "cliente"
    | "estrategico";
  readonly acaoRecomendada?: string;
}

/** Etapas habilitadas no ciclo de compras do cliente */
export interface EtapasFluxoCompraTenant {
  readonly solicitacao: boolean;
  readonly cotacao: boolean;
  readonly pedido: boolean;
  readonly notaEntrada: boolean;
}

/** Mapeamento de tabelas do ERP / Semantic Model que compõem o ciclo */
export interface TabelasProcessoCompraERP {
  readonly solicitacoes: string;
  readonly solicitacoesEventos: string;
  readonly cotacoes: string;
  readonly cotacoesItens: string;
  readonly cotacoesFornecedores: string;
  readonly ligacaoPedidoSolicitacao: string;
  readonly pedidos: string;
  readonly notas: string;
}

/** Configuração integral do processo de compra por tenant */
export interface ConfiguracaoProcessoCompraTenant {
  readonly habilitado: boolean;
  readonly tipoERP: "connectsoft-shopcash" | "generico" | "outro";
  readonly etapas: EtapasFluxoCompraTenant;
  readonly tabelasERP: TabelasProcessoCompraERP;
  readonly motivosRecusa: readonly MotivoRecusaCompraTenant[];
  readonly statusAprovacaoSolicitacao: Readonly<Record<string, string>>;
  readonly statusCotacao: Readonly<Record<string, string>>;
}

/**
 * Converte um valor hexadecimal (#RRGGBB) para componentes numéricos RGB e formato CSS.
 *
 * `cssRgb` sai com os canais SEPARADOS POR ESPAÇO ("11 57 176"), e não por
 * vírgula, porque é assim que o Tailwind monta `rgb(var(--x) / <alpha-value>)`.
 * É o que permite escrever `border-secundaria/30` — com a vírgula, qualquer
 * classe com opacidade sobre a cor do cliente simplesmente não pinta.
 */
export function hexParaRgb(hex: string): {
  r: number;
  g: number;
  b: number;
  cssRgb: string;
} {
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
    // Fundo ardósia neutro da plataforma, não a cor de um cliente.
    return { r: 30, g: 41, b: 59, cssRgb: "30 41 59" };
  }

  const r = (num >> 16) & 255;
  const g = (num >> 8) & 255;
  const b = num & 255;

  return { r, g, b, cssRgb: `${r} ${g} ${b}` };
}

/**
 * Mapeia a configuração de cores do tenant para um dicionário de CSS Variables.
 */
export function gerarVariaveisCssTenant(
  tenant: ConfiguracaoTenant,
): Record<string, string> {
  const rgbPrimaria = hexParaRgb(tenant.cores.primaria).cssRgb;
  const rgbSecundaria = hexParaRgb(tenant.cores.secundaria).cssRgb;
  const rgbDestaqueMultiplo = hexParaRgb(
    tenant.cores.fundoDestaqueMultiplo,
  ).cssRgb;

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
    // A grade pinta a linha de múltiplo de embalagem com opacidade (40% e 70%
    // no hover), e para isso precisa dos canais, não do hex.
    "--cor-destaque-multiplo-rgb": rgbDestaqueMultiplo,
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
