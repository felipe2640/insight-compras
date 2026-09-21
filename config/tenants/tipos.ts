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
  /**
   * Como a FONTE de dados do cliente nomeia esta loja (ex: CADEMP[ANOMEFANTASIA]).
   *
   * Serve para exibição e conferência do cadastro. NÃO serve de chave: o nome
   * fantasia é editável no ERP, e uma renomeação lá não pode desmontar a
   * carga aqui. A chave são os `identificadoresFonte`.
   */
  readonly nomeFonte?: string;
  /**
   * Valores EXATOS que a fonte devolve para identificar esta loja.
   *
   * Verificado ao vivo em 17/09/2026: no modelo da Carreiro toda tabela
   * (CADEMP, PRODUTOS, MOVESTOQ, NOTAS, PEDIDOS, ITEMSPEDIDO, TBL_COTACAO,
   * TBL_SOLICITACOES_COMPRAS e _HIST) traz o mesmo `"1|<guid>"`. A comparação
   * é exata depois de normalizar caixa e espaços — sem regex por cidade, sem
   * prefixo de GUID, sem `?? 1`. Valor fora desta lista é LOJA NÃO MAPEADA, e
   * a linha é descartada com aviso, nunca atribuída à matriz.
   *
   * Tenant sintético não precisa declarar: a fonte já devolve o filialId.
   */
  readonly identificadoresFonte?: readonly string[];
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

/**
 * Capacidades que o CADASTRO pode desligar.
 *
 * Quem diz o que a fonte CONSEGUE entregar é o adaptador (`capacidades` do
 * InventoryAdapter). O cadastro só subtrai: desliga o que o cliente ainda não
 * quer usar. Nunca liga o que a fonte não tem — prometer capacidade inexistente
 * é como o mock silencioso, promete dado que ninguém mediu.
 */
export type CapacidadeDesligavelTenant =
  | "pedidosERP"
  | "cotacoesERP"
  | "entradasConfirmadas"
  | "sugestoesErp";

/** Qual adaptador atende este cliente, e como a fonte dele se chama. */
export type AdaptadorFonteTenant = "powerbi-dax" | "sintetica";

export interface FonteDadosTenant {
  /**
   * "sintetica" nunca toca a nuvem de ninguém. Qualquer outro valor é fonte de
   * cliente REAL: exige credencial própria e, na falta dela, a plataforma
   * falha alto em vez de servir dado inventado (ADR-0002).
   */
  readonly adaptador: AdaptadorFonteTenant;
  /** Nome do ERP do cliente, só para rótulo (ex: "ConnectSoft ShopCash"). */
  readonly nomeERP?: string;
  /** Capacidades que a fonte entrega mas este cliente não quer usar ainda. */
  readonly capacidadesDesligadas?: readonly CapacidadeDesligavelTenant[];
}

/**
 * Natureza do tenant: decide login demo, exigência de credenciais e se dado
 * sintético pode aparecer. Derivada da fonte, nunca declarada à mão.
 */
export function naturezaTenant(
  tenant: Pick<ConfiguracaoTenant, "fonte">
): "real" | "sintetica" {
  return tenant.fonte.adaptador === "sintetica" ? "sintetica" : "real";
}

export type MetodoCurvaAbc = "GIRO" | "FATURAMENTO" | "ERP";

export interface ConfiguracaoCurvaAbcTenant {
  /**
   * Como a Curva ABC é determinada para o cliente:
   * - "GIRO": Alinhada à velocidade e recorrência real de vendas do motor de compra (A=Alto Giro, B=Médio Giro, C=Baixo Giro/Sem Histórico).
   * - "FATURAMENTO": Pareto financeiro clássico por faturamento acumulado (80% receita -> A, 15% -> B, 5% -> C).
   * - "ERP": Lê a coluna cadastrada no ERP do cliente (com fallback seguro se os dados forem mono-classe ou nulos).
   */
  readonly metodo: MetodoCurvaAbc;
  /** Se true (padrão), caso o método seja ERP e os dados estejam inválidos ou mono-classe (ex: 100% "B"), faz fallback para "GIRO" */
  readonly fallbackParaGiroSeErpInvalido?: boolean;
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
  /** De onde vêm os dados de estoque e venda DESTE cliente. */
  readonly fonte: FonteDadosTenant;
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
   * Como a Curva ABC é calculada/exibida para este cliente (Giro, Faturamento ou ERP).
   * Padrão caso omitido: "FATURAMENTO".
   */
  readonly curvaAbc?: ConfiguracaoCurvaAbcTenant;
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
