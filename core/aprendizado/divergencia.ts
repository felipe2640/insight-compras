/**
 * Ciclo de Aprendizado — Divergência modelo × comprador
 * Camada: Core Puro (TypeScript 100% puro, sem dependências externas)
 *
 * BASE COMUM A TODOS OS CLIENTES.
 * A taxonomia de motivos é o que separa "o modelo errou" de "o mundo interferiu".
 * Herdada do diário, onde foi validada com o comprador.
 */

export const MOTIVOS_DIVERGENCIA = [
  // 1. Decisões Comerciais e Oportunidades do Negócio (fatores externos — NÃO distorcem a calibragem estatística)
  { id: "promocao_fornecedor", rotulo: "Promoção / Oportunidade do fornecedor", grupo: "comercial", afetaCalibracao: false },
  { id: "decisao_interna", rotulo: "Decisão interna / Estratégica", grupo: "comercial", afetaCalibracao: false },
  { id: "lote_minimo_fornecedor", rotulo: "Lote mínimo / Embalagem do fornecedor", grupo: "comercial", afetaCalibracao: false },
  { id: "encomenda_cliente", rotulo: "Encomenda pontual de cliente / Oficina", grupo: "comercial", afetaCalibracao: false },
  { id: "sem_verba", rotulo: "Sem verba no momento (Corte financeiro)", grupo: "comercial", afetaCalibracao: false },
  { id: "fornecedor_indisponivel", rotulo: "Fornecedor indisponível / Sem estoque", grupo: "comercial", afetaCalibracao: false },
  { id: "lead_time_diferente", rotulo: "Prazo de entrega diferente", grupo: "comercial", afetaCalibracao: false },
  { id: "ja_tem_similar", rotulo: "Já tem similar em estoque na rede", grupo: "comercial", afetaCalibracao: false },

  // 2. Feedback de Calibração do Modelo (fatores de inteligência — AJUSTAM o algoritmo de IA)
  { id: "modelo_superestimou", rotulo: "Modelo superestimou (Giro menor que o esperado)", grupo: "calibracao", afetaCalibracao: true },
  { id: "modelo_subestimou", rotulo: "Modelo subestimou (Giro maior / Risco de ruptura)", grupo: "calibracao", afetaCalibracao: true },
  { id: "quantidade_errada", rotulo: "Quantidade sugerida errada", grupo: "calibracao", afetaCalibracao: true },
  { id: "item_obsoleto", rotulo: "Item obsoleto / Sem giro na região", grupo: "calibracao", afetaCalibracao: true },
  { id: "item_errado", rotulo: "Item não deveria ser sugerido", grupo: "calibracao", afetaCalibracao: true },
  { id: "concordo_com_modelo", rotulo: "Concordo com o modelo", grupo: "calibracao", afetaCalibracao: true },

  // 3. Outros
  { id: "outro", rotulo: "Outro motivo (especificar no comentário)", grupo: "outro", afetaCalibracao: false },
] as const;

export type MotivoDivergencia = (typeof MOTIVOS_DIVERGENCIA)[number]["id"];

export function motivoValido(valor: unknown): valor is MotivoDivergencia {
  return MOTIVOS_DIVERGENCIA.some((m) => m.id === valor);
}

export type TipoDivergencia =
  | "igual"
  | "comprador_maior"
  | "comprador_menor"
  | "sem_sugestao"
  | "so_modelo";

/**
 * Classifica a divergência entre o que o comprador decidiu e o que o modelo sugeriu.
 * `qtdModelo === null` significa item inelegível (o modelo não opinou).
 */
export function classificarDivergencia(
  qtdComprador: number,
  qtdModelo: number | null
): TipoDivergencia {
  if (qtdModelo === null) return "sem_sugestao";
  if (qtdComprador === qtdModelo) return "igual";
  if (qtdComprador === 0 && qtdModelo > 0) return "so_modelo";
  return qtdComprador > qtdModelo ? "comprador_maior" : "comprador_menor";
}
